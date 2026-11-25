import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
let server;
let devServer;
let baseUrl;
let devUrl;

async function unusedPort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(processHandle, url, label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (processHandle.exitCode !== null) throw new Error(`${label} exited before becoming ready`);
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`${label} did not start`);
}

before(async () => {
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  assert.equal(build.status, 0, 'production build must succeed');

  const port = await unusedPort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: root,
    env: {
      ...process.env, HOST: '127.0.0.1', PORT: String(port),
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'mock-publishable-key',
      APP_ORIGIN: 'https://admin.example',
    },
    stdio: 'ignore',
  });
  await waitForServer(server, baseUrl, 'Production server');

  const devPort = await unusedPort();
  devUrl = `http://127.0.0.1:${devPort}`;
  devServer = spawn(join(root, 'node_modules/.bin/astro'), ['dev', '--host', '127.0.0.1', '--port', String(devPort), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  });
  await waitForServer(devServer, devUrl, 'Development server');
});

after(async () => {
  for (const processHandle of [server, devServer]) {
    if (processHandle && processHandle.exitCode === null) {
      processHandle.kill();
      await once(processHandle, 'exit');
    }
  }
});

for (const [path, status, language, direction] of [
  ['/', 200, 'en', 'ltr'],
  ['/ar/', 200, 'ar', 'rtl'],
  ['/not-a-route', 404, 'en', 'ltr'],
  ['/dev/design-system', 404, 'en', 'ltr'],
  ['/dev/templates/', 404, 'en', 'ltr'],
  ['/ar/dev/templates/', 404, 'ar', 'rtl'],
]) {
  test(`${path} serves the expected non-indexable response`, async () => {
    const response = await fetch(`${baseUrl}${path}`);
    const html = await response.text();
    assert.equal(response.status, status);
    assert.match(html, new RegExp(`<html\\s+lang="${language}"\\s+dir="${direction}"`));
    assert.match(html, /<meta name="robots" content="noindex, nofollow"\s*\/?>/);
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    if (status === 404) {
      assert.match(html, language === 'ar' ? /الصفحة غير موجودة/ : /Page not found/);
    }
  });
}

test('production server reads configuration at runtime', async () => {
  const response = await fetch(`${baseUrl}/admin/login`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Administrator sign in/);
  assert.doesNotMatch(html, /mock-publishable-key/);
});

test('design showcase is available only in development and demonstrates UI specimens', async () => {
  const response = await fetch(`${devUrl}/dev/design-system`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Design system showcase/);
  assert.match(html, /Champagne gold/);
  assert.match(html, /Buttons and states/);
  assert.match(html, /Cards and containers/);
  assert.match(html, /Form field states/);
  assert.match(html, /معاينة اللغة العربية/);
  assert.match(html, /not a property listing/i);
});

test('page-template showcases are available in both languages during development only', async () => {
  for (const [path, lang, heading] of [
    ['/dev/templates/', 'en', 'Property listings template'],
    ['/ar/dev/templates/', 'ar', 'قالب قائمة العقارات'],
  ]) {
    const response = await fetch(`${devUrl}${path}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, new RegExp(`<html\\s+lang="${lang}"`));
    assert.ok(html.includes(heading));
    assert.match(html, /No verified|لا تتوفر|غير متاح|Translation unavailable|الترجمة غير متاحة/);
  }
});
