import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVED_PROJECT_REF,
  APPROVED_SUPABASE_URL,
  assertApprovedProjectRef,
  assertApprovedSupabaseUrl,
  assertHostedDatabaseService,
  assertLocalRestoreService,
  assertMediaObjectPath,
  parseServiceFile,
  sanitizedChildEnvironment,
} from '../scripts/backup/safety.mjs';
import { createTarHeader } from '../scripts/backup/tar.mjs';

const item = '123e4567-e89b-12d3-a456-426614174000';
const revision = '123e4567-e89b-12d3-a456-426614174001';
const media = '123e4567-e89b-12d3-a456-426614174002.webp';

test('only the approved Supabase project ref is accepted', () => {
  assert.doesNotThrow(() => assertApprovedProjectRef(APPROVED_PROJECT_REF));
  for (const ref of ['', 'otherprojectref', APPROVED_PROJECT_REF.toUpperCase(), `${APPROVED_PROJECT_REF}/`]) {
    assert.throws(() => assertApprovedProjectRef(ref));
  }
});

test('only the exact approved HTTPS Supabase URL is accepted', () => {
  assert.equal(APPROVED_SUPABASE_URL, 'https://tiojcfemilttggcuqycq.supabase.co');
  assert.doesNotThrow(() => assertApprovedSupabaseUrl(APPROVED_SUPABASE_URL));
  for (const url of [
    'http://tiojcfemilttggcuqycq.supabase.co',
    'https://other.supabase.co',
    `${APPROVED_SUPABASE_URL}.attacker.example`,
    `${APPROVED_SUPABASE_URL}/?redirect=elsewhere`,
  ]) {
    assert.throws(() => assertApprovedSupabaseUrl(url));
  }
});

test('hosted database service settings must match the approved project and TLS policy', () => {
  const service = {
    host: 'db.tiojcfemilttggcuqycq.supabase.co',
    port: '5432',
    dbname: 'postgres',
    user: 'postgres',
    sslmode: 'verify-full',
  };
  assert.doesNotThrow(() => assertHostedDatabaseService(service));
  assert.throws(() => assertHostedDatabaseService({ ...service, host: 'db.other.supabase.co' }));
  assert.throws(() => assertHostedDatabaseService({ ...service, sslmode: 'require' }));
});

test('local restore service allows only the dedicated local loopback database', async () => {
  const service = {
    host: '127.0.0.1',
    port: '54322',
    dbname: 'bahrainrealtor_restore',
    user: 'postgres',
    sslmode: 'disable',
  };
  await assert.doesNotReject(() => assertLocalRestoreService(service));
  await assert.rejects(() => assertLocalRestoreService({ ...service, host: 'db.example.com' }));
  await assert.rejects(() => assertLocalRestoreService({ ...service, dbname: 'postgres' }));
  await assert.rejects(() => assertLocalRestoreService({ ...service, host: '127.0.0.2' }));
});

test('service parser rejects passwords and unknown connection overrides', () => {
  const service = `[bahrainrealtor_backup]
host=db.tiojcfemilttggcuqycq.supabase.co
port=5432
dbname=postgres
user=postgres
sslmode=verify-full`;
  assert.deepEqual(
    parseServiceFile(service, 'bahrainrealtor_backup'),
    {
      host: 'db.tiojcfemilttggcuqycq.supabase.co',
      port: '5432',
      dbname: 'postgres',
      user: 'postgres',
      sslmode: 'verify-full',
    },
  );
  assert.throws(() => parseServiceFile(`${service}\npassword=do-not-allow`, 'bahrainrealtor_backup'));
  assert.throws(() => parseServiceFile(`${service}\nhostaddr=127.0.0.1`, 'bahrainrealtor_backup'));
  assert.equal(
    parseServiceFile(`${service}\n\n[bahrainrealtor_restore]\nhost=127.0.0.1`, 'bahrainrealtor_backup').host,
    'db.tiojcfemilttggcuqycq.supabase.co',
  );
  assert.throws(() =>
    parseServiceFile(`${service}\n\n[bahrainrealtor_restore]\npassword=do-not-allow`, 'bahrainrealtor_backup'),
  );
});

test('media paths must match exactly UUID/UUID/UUID.ext', () => {
  assert.doesNotThrow(() => assertMediaObjectPath(`${item}/${revision}/${media}`));
  for (const objectPath of [
    `${item}/${revision}/../${media}`,
    `${item}/${revision}/photo.jpg`,
    `${item}/${revision}/${media.toUpperCase()}`,
    `${item}/${revision}/${media}.jpg`,
    `/${item}/${revision}/${media}`,
    `${item}/${revision}/${media.replace('.webp', '.svg')}`,
    `${item}/${revision}/${media}\n`,
  ]) {
    assert.throws(() => assertMediaObjectPath(objectPath));
  }
});

test('child process environments omit credential-bearing overrides', () => {
  assert.deepEqual(
    sanitizedChildEnvironment({
      PATH: '/usr/bin',
      PGPASSWORD: 'test-only',
      SUPABASE_SERVICE_ROLE_KEY: 'test-only',
    }),
    { PATH: '/usr/bin' },
  );
});

test('tar headers encode both nested media paths and the root manifest safely', () => {
  const archivePath = `private-media/${item}/${revision}/${media}`;
  for (const [memberPath, name, prefix] of [
    [archivePath, media, `private-media/${item}/${revision}`],
    ['manifest.json', 'manifest.json', ''],
  ]) {
    const header = createTarHeader(memberPath, 17);
    assert.equal(header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, ''), name);
    assert.equal(header.subarray(345, 500).toString('utf8').replace(/\0.*$/s, ''), prefix);
    assert.equal(header.subarray(257, 263).toString('ascii'), 'ustar\0');
    const checksumCopy = Buffer.from(header);
    checksumCopy.fill(0x20, 148, 156);
    const expectedChecksum = checksumCopy.reduce((sum, byte) => sum + byte, 0);
    assert.equal(Number.parseInt(header.subarray(148, 154).toString('ascii'), 8), expectedChecksum);
  }
});
