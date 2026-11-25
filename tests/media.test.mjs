import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { MAX_MEDIA_PER_REVISION, mediaMutationAllowed, protectedJson, readBoundedBody } from '../src/server/media/admin.ts';
import { MAX_MEDIA_BYTES, safeObjectKey, validateImage } from '../src/server/media/validation.ts';
import sharp from 'sharp';
import { optimizeImage } from '../src/server/media/optimize.ts';
import { getOrCreateOptimizedImage } from '../src/server/media/cache.ts';

const item = '11111111-1111-4111-8111-111111111111';
const revision = '22222222-2222-4222-8222-222222222222';
const file = (bytes, type) => new File([bytes], 'image', { type });

function png(width = 1200, height = 800) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

test('image validation matches sniffed format and enforces byte and pixel bounds', async () => {
  const valid = await validateImage(file(png(), 'image/png'));
  assert.deepEqual({ type: valid.type, width: valid.width, height: valid.height }, { type: 'image/png', width: 1200, height: 800 });
  assert.equal(await validateImage(file(png(), 'image/jpeg')), null);
  assert.equal(await validateImage(file(png(8001, 1), 'image/png')), null);
  assert.equal(await validateImage(file(png(8000, 8000), 'image/png')), null);
  assert.equal(await validateImage(file(new Uint8Array(MAX_MEDIA_BYTES + 1), 'image/png')), null);
  assert.equal(await validateImage(file(new Uint8Array([0x89, 0x50]), 'image/png')), null);
});

test('optimization decodes, resizes, re-encodes WebP and strips metadata', async () => {
  const source = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: { r: 80, g: 110, b: 140 } },
  }).jpeg().withMetadata({ exif: { IFD0: { ImageDescription: 'private-metadata' } } }).toBuffer();
  const optimized = await optimizeImage(new Uint8Array(source));
  const metadata = await sharp(optimized.bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 800);
  assert.equal(metadata.exif, undefined);
  assert.ok(optimized.bytes.byteLength > 0);
  await assert.rejects(() => optimizeImage(new Uint8Array([0xff, 0xd8, 0xff])));
});

test('public image processing coalesces concurrent requests and caches bounded outputs', async () => {
  const key = `media-cache-test-${crypto.randomUUID()}`;
  let calls = 0;
  const create = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Uint8Array([1, 2, 3]);
  };
  const [first, second] = await Promise.all([
    getOrCreateOptimizedImage(key, create),
    getOrCreateOptimizedImage(key, create),
  ]);
  assert.deepEqual(first, new Uint8Array([1, 2, 3]));
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
  await getOrCreateOptimizedImage(key, create);
  assert.equal(calls, 1);
});

test('object keys are generated from UUIDs and a fixed image extension allowlist', () => {
  assert.equal(
    safeObjectKey(item, revision, 'webp', '33333333-3333-4333-8333-333333333333'),
    `${item}/${revision}/33333333-3333-4333-8333-333333333333.webp`,
  );
  assert.throws(() => safeObjectKey('../other', revision, 'jpg'));
  assert.throws(() => safeObjectKey(item, revision, 'svg'));
});

test('media mutations enforce exact origin, method and content type', () => {
  const request = (method, origin, contentType) => new Request('https://admin.example/api/admin/media', {
    method, headers: { origin, 'content-type': contentType },
  });
  assert.equal(mediaMutationAllowed(request('POST', 'https://admin.example', 'multipart/form-data; boundary=abc'), 'https://admin.example'), true);
  assert.equal(mediaMutationAllowed(request('POST', 'https://evil.example', 'multipart/form-data; boundary=abc'), 'https://admin.example'), false);
  assert.equal(mediaMutationAllowed(request('DELETE', 'https://admin.example', 'application/json'), 'https://admin.example'), true);
  assert.equal(mediaMutationAllowed(request('PATCH', 'https://admin.example', 'text/plain'), 'https://admin.example'), false);
  assert.equal(mediaMutationAllowed(request('POST', 'https://admin.example', 'application/json'), 'https://admin.example'), false);
  const crossSite = new Request('https://admin.example', {
    method: 'DELETE', headers: { origin: 'https://admin.example', 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
  });
  assert.equal(mediaMutationAllowed(crossSite, 'https://admin.example'), false);
});

test('multipart reads are capped and API responses cannot be cached or indexed', async () => {
  const request = new Request('https://admin.example', {
    method: 'POST', headers: { 'content-length': String(MAX_MEDIA_BYTES + 64_001) }, body: 'x',
  });
  assert.equal(await readBoundedBody(request), null);
  const response = protectedJson({ media: [] });
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('admin APIs enforce MFA and public delivery requires published media, service storage access, and re-encoding', async () => {
  const listUpload = await readFile(new URL('../src/pages/api/admin/media/index.ts', import.meta.url), 'utf8');
  const mediaId = await readFile(new URL('../src/pages/api/admin/media/[id].ts', import.meta.url), 'utf8');
  const delivery = await readFile(new URL('../src/pages/api/media/[id].ts', import.meta.url), 'utf8');
  for (const route of [listUpload, mediaId]) {
    assert.match(route, /mediaAdmin\(request, cookies\)/);
    assert.match(route, /mediaMutationAllowed\(request, auth\.config\.origin\)/);
    assert.match(route, /protectedJson/);
  }
  assert.match(listUpload, /storage\.from\(MEDIA_BUCKET\)\.upload/);
  assert.match(mediaId, /storage\.from\(MEDIA_BUCKET\)\.remove/);
  assert.match(delivery, /from\('published_content_media'\)/);
  assert.match(delivery, /createServiceClient\(\)/);
  assert.match(delivery, /storage\.from\(MEDIA_BUCKET\)\.download/);
  assert.match(delivery, /optimizeImage/);
  assert.match(delivery, /getOrCreateOptimizedImage/);
  assert.match(delivery, /Content-Type': 'image\/webp'/);
  assert.doesNotMatch(delivery, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test('media migration limits bucket uploads and ties anonymous reads to the published revision', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261124000300_media.sql', import.meta.url), 'utf8');
  assert.match(migration, /set public = false/);
  assert.match(migration, /file_size_limit = 8388608/);
  assert.match(migration, /allowed_mime_types = array\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
  assert.match(migration, /foreign key \(revision_id, item_id, locale\)/);
  assert.match(migration, /length\(btrim\(alt_text\)\) between 1 and 500/);
  assert.match(migration, /unique index content_media_one_cover_per_revision/);
  assert.match(migration, /content_media_published_read/);
  assert.match(migration, /private\.published_media_object_path\(content_media\.object_path\)/);
  assert.match(migration, /create function private\.published_media_object_path[\s\S]*?join public\.publications/);
  assert.match(migration, /published_content_media/);
  assert.doesNotMatch(migration.match(/create view public\.published_content_media[\s\S]*?;/)?.[0] ?? '', /object_path/);
  assert.match(migration, /private_media_published_select/);
  assert.match(migration, /revoke all on public\.content_media from public, anon, authenticated, service_role/);
  assert.match(migration, /set_content_media_metadata/);
  assert.match(migration, /create function public\.create_content_media/);
  assert.match(migration, /if media_count >= 20 then/);
  assert.match(migration, /revoke insert on public\.content_media from public, anon, authenticated, service_role/);
  assert.equal(MAX_MEDIA_PER_REVISION, 20);
});

test('upload API rejects full revisions before storage and repeats the cap in its atomic insert', async () => {
  const upload = await readFile(new URL('../src/pages/api/admin/media/index.ts', import.meta.url), 'utf8');
  assert.match(upload, /current\.data\.length >= MAX_MEDIA_PER_REVISION/);
  assert.match(upload, /rpc\('create_content_media'/);
  assert.match(upload, /optimizeImage/);
  assert.match(upload, /safeObjectKey\(target\.item_id, target\.id, 'webp'\)/);
  assert.match(upload, /Revision image limit reached/);
  assert.match(upload, /maximum of 20 images/);
});

test('forward migration blocks public access to private originals and metadata paths', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261125000100_secure_media_delivery.sql', import.meta.url), 'utf8');
  assert.match(migration, /revoke select on public\.content_media from anon/);
  assert.match(migration, /drop policy content_media_published_read/);
  assert.match(migration, /private_media_restrict_select[\s\S]*?private\.is_admin\(\)/);
  assert.match(migration, /private_media_anonymous_denied[\s\S]*?using \(bucket_id <> 'private-media'\)/);
});
