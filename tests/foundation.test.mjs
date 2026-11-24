import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let server;
let baseUrl;

before(async () => {
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  assert.equal(build.status, 0, 'production build must succeed');

  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));

  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: root,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Production server exited before becoming ready');
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Production server did not start');
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
});

for (const [path, status, language, direction] of [
  ['/', 200, 'en', 'ltr'],
  ['/ar/', 200, 'ar', 'rtl'],
  ['/not-a-route', 404, 'en', 'ltr'],
]) {
  test(`${path} serves the expected non-indexable response`, async () => {
    const response = await fetch(`${baseUrl}${path}`);
    const html = await response.text();
    assert.equal(response.status, status);
    assert.match(html, new RegExp(`<html\\s+lang="${language}"\\s+dir="${direction}"`));
    assert.match(html, /<meta name="robots" content="noindex, nofollow"\s*\/?>/);
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    if (status === 404) assert.match(html, /Page not found/);
  });
}
