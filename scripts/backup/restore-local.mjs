#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import {
  assertApprovedProjectRef,
  assertLocalRestoreService,
  parseServiceFile,
  assertProtectedFile,
  sanitizedChildEnvironment,
  sanitizedPostgresEnvironment,
} from './safety.mjs';

const [projectRef, archivePath] = process.argv.slice(2);

try {
  assertApprovedProjectRef(projectRef);
  if (!archivePath) {
    throw new Error('Usage: restore-local.mjs <approved-project-ref> <absolute-encrypted-dump-path>');
  }
  const serviceFile = process.env.PGSERVICEFILE;
  const passwordFile = process.env.PGPASSFILE;
  await assertProtectedFile(serviceFile, 'PGSERVICEFILE');
  await assertProtectedFile(passwordFile, 'PGPASSFILE');
  await assertProtectedFile(archivePath, 'Encrypted archive');
  const service = parseServiceFile(await readFile(serviceFile, 'utf8'), 'bahrainrealtor_restore');
  await assertLocalRestoreService(service);

  const env = sanitizedPostgresEnvironment(
    process.env,
    serviceFile,
    passwordFile,
    'bahrainrealtor_restore',
  );
  const decryptor = spawn('gpg', ['--decrypt', archivePath], {
    env: sanitizedChildEnvironment(process.env),
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const restorer = spawn(
    'pg_restore',
    [
      '--no-password',
      '--exit-on-error',
      '--single-transaction',
      '--no-owner',
      '--no-acl',
      '--dbname=service=bahrainrealtor_restore',
    ],
    { env, stdio: ['pipe', 'ignore', 'ignore'] },
  );
  const exitCode = (child) =>
    new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code) => resolve(code));
    });
  const decryptExit = exitCode(decryptor);
  const restoreExit = exitCode(restorer);
  try {
    await pipeline(decryptor.stdout, restorer.stdin);
  } catch {
    throw new Error('Local restore pipeline failed.');
  }
  const [decryptCode, restoreCode] = await Promise.all([decryptExit, restoreExit]);
  if (decryptCode !== 0 || restoreCode !== 0) {
    throw new Error('Local restore failed. Check the encrypted archive and local PostgreSQL setup.');
  }
  console.log('Encrypted database archive restored to the isolated local database.');
} catch (error) {
  console.error(error?.message || 'Local restore failed.');
  process.exitCode = 1;
}
