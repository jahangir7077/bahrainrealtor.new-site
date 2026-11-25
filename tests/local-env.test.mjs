import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

async function unusedPort() {
  const socket = createServer().listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

test('development loads server-only .env values without overriding runtime settings', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'br-env-test-'));
  let server;
  try {
    for (const path of ['src', 'astro.config.mjs', 'package.json', 'tsconfig.json']) {
      await cp(join(root, path), join(fixture, path), { recursive: true });
    }
    await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    const port = await unusedPort();
    const base = `http://127.0.0.1:${port}`;
    await writeFile(join(fixture, '.env'), [
      'SUPABASE_URL=https://example.supabase.co',
      'SUPABASE_PUBLISHABLE_KEY=mock-publishable-key',
      'SUPABASE_SERVICE_ROLE_KEY=server-only-test-secret',
      `APP_ORIGIN=${base}`,
    ].join('\n'));
    const env = { ...process.env };
    delete env.SUPABASE_URL;
    delete env.SUPABASE_PUBLISHABLE_KEY;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    delete env.APP_ORIGIN;
    for (const [override, expected] of [[undefined, 200], ['http://remote.invalid', 503]]) {
      server = spawn(join(root, 'node_modules/.bin/astro'), [
        'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--ignore-lock',
      ], { cwd: fixture, env: override ? { ...env, APP_ORIGIN: override } : env, stdio: 'ignore' });
      let response;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null) throw new Error('development server exited');
        try { response = await fetch(`${base}/admin/login`); break; }
        catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
      }
      assert.ok(response, 'development server started');
      assert.equal(response.status, expected);
      const html = await response.text();
      assert.match(html, /Administrator sign in/);
      assert.doesNotMatch(html, /server-only-test-secret|mock-publishable-key/);
      server.kill();
      await once(server, 'exit');
      server = undefined;
    }
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await once(server, 'exit');
    }
    await rm(fixture, { recursive: true, force: true });
  }
});
