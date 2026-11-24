#!/usr/bin/env node
import { open, unlink, link } from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import {
  APPROVED_PROJECT_REF,
  APPROVED_SUPABASE_URL,
  MEDIA_BUCKET,
  assertApprovedProjectRef,
  assertApprovedSupabaseUrl,
  assertMediaObjectPath,
  preparePrivateOutputDirectory,
  sanitizedChildEnvironment,
} from './safety.mjs';
import { writeTarEntry } from './tar.mjs';

const LIST_PAGE_SIZE = 100;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024 * 1024;
const MAX_FILES = 10_000;
const MAX_LIST_ENTRIES = MAX_FILES * 3;
const MAX_LIST_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const TOTAL_RUNTIME_MS = 2 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function failure(message, retryable = false) {
  const error = new Error(message);
  error.retryable = retryable;
  return error;
}

function retryDelay(attempt) {
  return new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
}

async function readJsonResponse(response) {
  if (!response.body) throw new Error('Storage API returned invalid list data.');
  const chunks = [];
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > MAX_LIST_RESPONSE_BYTES) {
        throw failure('Storage API list response exceeds the configured limit.');
      }
      chunks.push(Buffer.from(chunk));
    }
  } catch (error) {
    if (error?.retryable === false) throw error;
    throw failure('Storage API list response failed.', true);
  }
  try {
    return JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
  } catch {
    throw new Error('Storage API returned invalid list data.');
  }
}

function checkRuntime(deadline) {
  if (Date.now() > deadline) throw new Error('Backup exceeded the two-hour runtime limit.');
}

async function request(url, options, deadline, attempts = MAX_ATTEMPTS) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    checkRuntime(deadline);
    try {
      const response = await fetch(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(Math.max(1, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()))),
      });
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) {
        throw failure(`Storage API returned HTTP ${response.status}.`);
      }
      lastError = failure(`Storage API returned HTTP ${response.status}.`, true);
      await response.body?.cancel();
    } catch (error) {
      if (error?.retryable === false) throw error;
      if (error instanceof Error && error.message.startsWith('Storage API returned HTTP ')) {
        lastError = error;
      } else {
        lastError = failure('Storage API request failed.', true);
      }
    }
    if (attempt + 1 < attempts) await retryDelay(attempt);
  }
  throw lastError || failure('Storage API request failed.', true);
}

async function listDirectory(prefix, level, headers, deadline, counters) {
  const results = [];
  let offset = 0;
  while (true) {
    checkRuntime(deadline);
    const url = new URL(`/storage/v1/object/list/${MEDIA_BUCKET}`, APPROVED_SUPABASE_URL);
    const options = {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        prefix,
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    };
    let entries;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await request(url, options, deadline, 1);
        entries = await readJsonResponse(response);
        break;
      } catch (error) {
        if (error?.retryable !== true || attempt + 1 === MAX_ATTEMPTS) throw error;
        await retryDelay(attempt);
      }
    }
    if (!Array.isArray(entries)) throw new Error('Storage API returned invalid list data.');
    counters.listEntries += entries.length;
    if (counters.listEntries > MAX_LIST_ENTRIES) throw new Error('Storage listing exceeds the configured safety limit.');
    for (const entry of entries) {
      if (!entry || typeof entry.name !== 'string' || entry.name.includes('/') || entry.name.includes('\\')) {
        throw new Error('Storage API returned an invalid object name.');
      }
      if (level < 2) {
        if (entry.id !== null || !UUID.test(entry.name)) {
          throw new Error('Storage API returned a path outside the approved media layout.');
        }
        results.push(entry.name);
      } else {
        if (entry.id === null) throw new Error('Unexpected folder in the approved media layout.');
        const objectPath = `${prefix}/${entry.name}`;
        assertMediaObjectPath(objectPath);
        results.push(objectPath);
        if (results.length > MAX_FILES) throw new Error('Media file count exceeds the configured limit.');
      }
    }
    if (entries.length < LIST_PAGE_SIZE) break;
    offset += entries.length;
  }
  return results;
}

async function listObjects(headers, deadline) {
  const counters = { listEntries: 0 };
  const paths = [];
  const itemIds = await listDirectory('', 0, headers, deadline, counters);
  for (const itemId of itemIds) {
    const revisionIds = await listDirectory(itemId, 1, headers, deadline, counters);
    for (const revisionId of revisionIds) {
      paths.push(...await listDirectory(`${itemId}/${revisionId}`, 2, headers, deadline, counters));
      if (paths.length > MAX_FILES) throw new Error('Media file count exceeds the configured limit.');
    }
  }
  if (new Set(paths).size !== paths.length) throw new Error('Storage API returned duplicate object paths.');
  return paths;
}

async function downloadObject(objectPath, headers, deadline, totalBytes) {
  checkRuntime(deadline);
  assertMediaObjectPath(objectPath);
  const url = new URL(
    `/storage/v1/object/${MEDIA_BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`,
    APPROVED_SUPABASE_URL,
  );
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await request(url, { headers }, deadline, 1);
      const lengthHeader = response.headers.get('content-length');
      if (lengthHeader !== null && (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > MAX_FILE_BYTES)) {
        await response.body?.cancel();
        throw failure('Media object exceeds the per-file size limit.');
      }
      const chunks = [];
      let size = 0;
      if (!response.body) throw failure('Storage API returned an empty response.');
      try {
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > MAX_FILE_BYTES || totalBytes.current + size > MAX_TOTAL_BYTES) {
            throw failure('Media export exceeds the configured size limit.');
          }
          chunks.push(Buffer.from(chunk));
        }
      } catch (error) {
        if (error?.retryable === false) throw error;
        throw failure('Storage API download failed.', true);
      }
      if (size === 0) throw failure('Storage API returned an empty media object.');
      totalBytes.current += size;
      return Buffer.concat(chunks, size);
    } catch (error) {
      if (error?.retryable !== true) throw error;
      lastError = failure('Storage API download failed.', true);
      if (attempt + 1 < MAX_ATTEMPTS) await retryDelay(attempt);
    }
  }
  throw lastError;
}

const [projectRef, destination] = process.argv.slice(2);
let outputPath;
let partialPath;
let outputHandle;
let encryptor;
let promoted = false;
let runtimeTimer;

try {
  assertApprovedProjectRef(projectRef);
  assertApprovedSupabaseUrl(APPROVED_SUPABASE_URL);
  if (!destination) throw new Error('Usage: media.mjs <approved-project-ref> <absolute-output-directory>');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !serviceKey.trim()) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in the process environment.');
  }

  const outputDir = await preparePrivateOutputDirectory(destination);
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  outputPath = path.join(outputDir, `media-${APPROVED_PROJECT_REF}-${stamp}.tar.gpg`);
  partialPath = `${outputPath}.partial`;
  outputHandle = await open(partialPath, 'wx', 0o600);
  encryptor = spawn(
    'gpg',
    ['--symmetric', '--cipher-algo', 'AES256', '--output', '-'],
    { env: sanitizedChildEnvironment(process.env), stdio: ['pipe', outputHandle.fd, 'ignore'] },
  );
  const encryptExit = once(encryptor, 'close').then(([code]) => code).catch(() => -1);
  encryptor.once('error', () => {});

  const headers = {
    apikey: serviceKey,
    authorization: 'Bearer ' + serviceKey,
  };
  const deadline = Date.now() + TOTAL_RUNTIME_MS;
  runtimeTimer = setTimeout(() => encryptor?.kill('SIGTERM'), TOTAL_RUNTIME_MS);
  const objects = await listObjects(headers, deadline);
  let totalFiles = 0;
  const totalBytes = { current: 0 };
  const manifest = [];
  for (const objectPath of objects) {
    checkRuntime(deadline);
    const data = await downloadObject(objectPath, headers, deadline, totalBytes);
    await writeTarEntry(encryptor.stdin, `${MEDIA_BUCKET}/${objectPath}`, data);
    totalFiles += 1;
    manifest.push({ path: objectPath, bytes: data.length });
  }
  const manifestText = Buffer.from(JSON.stringify({
    format: 'bahrainrealtor-private-media-backup-v1',
    projectRef: APPROVED_PROJECT_REF,
    bucket: MEDIA_BUCKET,
    createdAt: new Date().toISOString(),
    files: manifest,
  }, null, 2));
  await writeTarEntry(encryptor.stdin, 'manifest.json', manifestText);
  await writeChunk(encryptor.stdin, Buffer.alloc(1024));
  encryptor.stdin.end();
  const code = await encryptExit;
  if (code !== 0) throw new Error('GPG encryption failed.');
  await outputHandle.chmod(0o600);
  await outputHandle.close();
  outputHandle = undefined;
  await link(partialPath, outputPath);
  promoted = true;
  await unlink(partialPath);
  clearTimeout(runtimeTimer);
  console.log(`Encrypted private-media backup created (${totalFiles} files, ${totalBytes.current} bytes): ${outputPath}`);
} catch (error) {
  clearTimeout(runtimeTimer);
  encryptor?.kill('SIGTERM');
  encryptor?.stdin?.destroy();
  if (outputHandle) await outputHandle.close().catch(() => {});
  if (partialPath) await unlink(partialPath).catch(() => {});
  if (promoted && outputPath) await unlink(outputPath).catch(() => {});
  console.error(error?.message || 'Media backup failed.');
  process.exitCode = 1;
}
