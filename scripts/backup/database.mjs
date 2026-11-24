#!/usr/bin/env node
import { readFile, open, unlink, link } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import {
  APPROVED_PROJECT_REF,
  assertApprovedProjectRef,
  assertHostedDatabaseService,
  parseServiceFile,
  assertProtectedFile,
  preparePrivateOutputDirectory,
  sanitizedChildEnvironment,
  sanitizedPostgresEnvironment,
} from './safety.mjs';

const [projectRef, destination] = process.argv.slice(2);
let outputPath;
let partialPath;
let outputHandle;
let failed = false;
let promoted = false;

try {
  assertApprovedProjectRef(projectRef);
  if (!destination) throw new Error('Usage: database.mjs <approved-project-ref> <absolute-output-directory>');

  const serviceFile = process.env.PGSERVICEFILE;
  const passwordFile = process.env.PGPASSFILE;
  await assertProtectedFile(serviceFile, 'PGSERVICEFILE');
  await assertProtectedFile(passwordFile, 'PGPASSFILE');
  const service = parseServiceFile(await readFile(serviceFile, 'utf8'), 'bahrainrealtor_backup');
  assertHostedDatabaseService(service);
  const env = sanitizedPostgresEnvironment(
    process.env,
    serviceFile,
    passwordFile,
    'bahrainrealtor_backup',
  );
  const outputDir = await preparePrivateOutputDirectory(destination);
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  outputPath = path.join(outputDir, `database-${APPROVED_PROJECT_REF}-${stamp}.dump.gpg`);
  partialPath = `${outputPath}.partial`;
  outputHandle = await open(partialPath, 'wx', 0o600);

  const encryptor = spawn(
    'gpg',
    ['--symmetric', '--cipher-algo', 'AES256', '--output', '-'],
    { env: sanitizedChildEnvironment(process.env), stdio: ['pipe', outputHandle.fd, 'ignore'] },
  );
  const dumper = spawn(
    'pg_dump',
    ['--no-password', '--format=custom', '--no-owner', '--no-acl', '--service=bahrainrealtor_backup', '--file=-'],
    { env, stdio: ['ignore', 'pipe', 'ignore'] },
  );

  const exitCode = (child) =>
    new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code) => resolve(code));
    });
  const dumpExit = exitCode(dumper);
  const encryptExit = exitCode(encryptor);
  try {
    await pipeline(dumper.stdout, encryptor.stdin);
  } catch {
    failed = true;
  }
  const [dumpCode, encryptCode] = await Promise.all([dumpExit, encryptExit]);
  if (failed || dumpCode !== 0 || encryptCode !== 0) {
    throw new Error('Backup failed. Check local PostgreSQL/GPG installation and protected configuration.');
  }
  await outputHandle.chmod(0o600);
  await outputHandle.close();
  outputHandle = undefined;
  await link(partialPath, outputPath);
  promoted = true;
  await unlink(partialPath);
  console.log(`Encrypted database backup created: ${outputPath}`);
} catch (error) {
  if (outputHandle) await outputHandle.close().catch(() => {});
  if (partialPath) await unlink(partialPath).catch(() => {});
  if (promoted && outputPath) await unlink(outputPath).catch(() => {});
  console.error(error?.message || 'Database backup failed.');
  process.exitCode = 1;
}
