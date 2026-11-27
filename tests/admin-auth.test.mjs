import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { configuredOrigin, one, readForm, validMutation } from '../src/server/auth/security.ts';
import { membership, mfaState, resolveSettings } from '../src/server/auth/session.ts';

test('configuration accepts only HTTPS except explicitly enabled loopback development', () => {
  const env = { SUPABASE_URL: 'https://project.example', SUPABASE_PUBLISHABLE_KEY: 'key', APP_ORIGIN: 'https://admin.example' };
  assert.ok(resolveSettings(env, false));
  assert.equal(resolveSettings({ ...env, APP_ORIGIN: 'https://admin.example/path' }, false), null);
  assert.equal(resolveSettings({ ...env, SUPABASE_URL: 'http://remote.example' }, true), null);
  assert.equal(resolveSettings({ ...env, SUPABASE_URL: 'http://localhost:54321' }, false), null);
  assert.ok(resolveSettings({ ...env, SUPABASE_URL: 'http://localhost:54321', APP_ORIGIN: 'http://127.0.0.1:4321' }, true));
  assert.equal(configuredOrigin('******example.com'), null);
});

test('mutations require exact origin and a simple form; form fields must be unique and bounded', async () => {
  const req = (origin, type = 'application/x-www-form-urlencoded') => new Request('https://admin.example', {
    method: 'POST', headers: { origin, 'content-type': type }, body: 'code=123456&code=654321',
  });
  assert.equal(validMutation(req('https://admin.example'), 'https://admin.example'), true);
  assert.equal(validMutation(req('https://evil.example'), 'https://admin.example'), false);
  assert.equal(validMutation(req('https://admin.example', 'application/json'), 'https://admin.example'), false);
  assert.equal(validMutation(new Request('https://admin.example', { method: 'POST' }), 'https://admin.example'), false);
  assert.equal(one(await readForm(req('https://admin.example')), 'code', 6), null);
  assert.equal(await readForm(new Request('https://admin.example', { method: 'POST', body: 'x'.repeat(8193) })), null);
});

test('membership and MFA authorization fail closed', async () => {
  const makeClient = (profile, auth = {}) => ({
    auth: {
      getUser: async () => auth.userError ? { data: { user: null }, error: {} } : { data: { user: { id: 'user' } }, error: null },
      mfa: {
        listFactors: async () => auth.factorError ? { data: null, error: {} } : { data: { all: auth.all ?? [], totp: auth.totp ?? [] }, error: null },
        getAuthenticatorAssuranceLevel: async () => auth.assuranceError ? { data: null, error: {} } : { data: { currentLevel: auth.level, currentAuthenticationMethods: auth.methods ?? [] }, error: null },
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => profile }) }) }) }),
  });
  assert.equal(await membership(makeClient({ data: null, error: {} })), null);
  assert.equal(await membership(makeClient({ data: { id: 'user', authorized: false }, error: null })), null);
  assert.equal(await membership(makeClient({ data: { id: 'other', authorized: true }, error: null })), null);
  assert.equal(await membership(makeClient({ data: { id: 'user', authorized: true }, error: null }, { userError: true })), null);
  assert.ok(await membership(makeClient({ data: { id: 'user', authorized: true }, error: null })));
  const totp = { id: 'factor', status: 'verified', factor_type: 'totp' };
  assert.equal(await mfaState(makeClient(null, { factorError: true })), null);
  assert.equal(await mfaState(makeClient(null, { assuranceError: true })), null);
  assert.equal((await mfaState(makeClient(null, { all: [totp], totp: [totp], level: 'aal1', methods: [{ method: 'totp' }] }))).authorized, false);
  assert.equal((await mfaState(makeClient(null, { all: [totp], totp: [totp], level: 'aal2', methods: [{ method: 'mfa/phone' }] }))).authorized, false);
  assert.equal((await mfaState(makeClient(null, { all: [], totp: [], level: 'aal2', methods: [{ method: 'totp' }] }))).authorized, false);
  assert.equal((await mfaState(makeClient(null, { all: [totp], totp: [totp], level: 'aal2', methods: [{ method: 'totp' }] }))).authorized, true);
});

let server;
let provider;
let base;
let providerUrl;
let factor;
const userId = '00000000-0000-4000-8000-000000000001';
const factorId = '00000000-0000-4000-8000-000000000002';
const enquiryId = '00000000-0000-4000-8000-000000000003';
let enquiryStatus = 'new';
const user = () => ({ id: userId, aud: 'authenticated', app_metadata: {}, user_metadata: {}, factors: factor ? [factor] : [] });
const token = (aal) => [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({
  sub: userId, aal, exp: Math.floor(Date.now() / 1000) + 3600,
  amr: aal === 'aal2' ? [{ method: 'password' }, { method: 'totp' }] : [{ method: 'password' }],
})).toString('base64url'), Buffer.from('mock-signature').toString('base64url')].join('.');
const session = (aal) => ({ access_token: token(aal), refresh_token: 'refresh-token', expires_in: 3600, token_type: 'bearer', user: user() });

before(async () => {
  provider = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.setHeader('content-type', 'application/json');
    let data;
    if (req.url.startsWith('/auth/v1/token?grant_type=password')) data = session('aal1');
    else if (req.url === '/auth/v1/user') data = user();
    else if (req.url.startsWith('/rest/v1/admin_profiles')) data = { id: userId, authorized: true };
    else if (req.url.startsWith('/rest/v1/enquiries') && req.method === 'GET') {
      data = [{
        id: enquiryId, property_item_id: null, locale: 'en', name: 'Test Enquirer',
        email: 'person@example.test', telephone: null, message: 'Please contact me.',
        consent_text: 'Test consent copy.', status: enquiryStatus, created_at: '2026-01-01T00:00:00Z',
      }];
    } else if (req.url.startsWith('/rest/v1/enquiry_notifications') && req.method === 'GET') {
      data = [{
        enquiry_id: enquiryId, status: 'pending', attempts: 1,
        last_attempt_at: '2026-01-01T00:01:00Z', next_attempt_at: '2026-01-01T00:02:00Z',
        delivered_at: null, last_http_status: 503,
      }];
    } else if (req.url.startsWith('/rest/v1/enquiries') && req.method === 'PATCH') {
      enquiryStatus = JSON.parse(body).status;
      data = [{ id: enquiryId }];
    }
    else if (req.url === '/auth/v1/factors' && req.method === 'POST') {
      factor = { id: factorId, factor_type: 'totp', status: 'unverified' };
      data = { id: factorId, type: 'totp', totp: { secret: 'TESTSECRET', qr_code: '', uri: '' } };
    } else if (req.url === `/auth/v1/factors/${factorId}/challenge`) data = { id: 'challenge', type: 'totp' };
    else if (req.url === `/auth/v1/factors/${factorId}/verify` && JSON.parse(body).code === '123456') {
      factor.status = 'verified';
      data = session('aal2');
    } else if (req.url.startsWith('/auth/v1/logout')) data = {};
    else { res.statusCode = 404; data = { message: 'not found' }; }
    res.end(JSON.stringify(data));
  }).listen(0, '127.0.0.1');
  await once(provider, 'listening');
  providerUrl = `http://127.0.0.1:${provider.address().port}`;
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn('node_modules/.bin/astro', ['dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--ignore-lock'], {
    env: { ...process.env, SUPABASE_URL: providerUrl, SUPABASE_PUBLISHABLE_KEY: 'test-key', APP_ORIGIN: base },
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('development server exited');
    try { await fetch(base); return; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  throw new Error('development server did not start');
});

after(async () => {
  if (server && server.exitCode === null) { server.kill(); await once(server, 'exit'); }
  if (provider) await new Promise((resolve) => provider.close(resolve));
});

test('mocked SSR login, TOTP enrollment and verification enforce session and CSRF', async () => {
  let cookies = new Map();
  const request = async (path, form, origin = base) => {
    const response = await fetch(base + path, {
      method: form ? 'POST' : 'GET', redirect: 'manual',
      headers: { ...(form ? { origin, 'content-type': 'application/x-www-form-urlencoded' } : {}), cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
      ...(form ? { body: new URLSearchParams(form) } : {}),
    });
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const index = pair.indexOf('=');
      if (/max-age=0/i.test(header)) cookies.delete(pair.slice(0, index));
      else cookies.set(pair.slice(0, index), pair.slice(index + 1));
      assert.match(header, /httponly/i);
      assert.match(header, /secure/i);
      assert.match(header, /samesite=strict/i);
      assert.match(header, /path=\//i);
    }
    if (response.status !== 403 || response.headers.has('cache-control')) {
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
    }
    return response;
  };
  assert.equal((await request('/admin/')).headers.get('location'), '/admin/login');
  assert.equal((await request('/admin/login', { email: 'admin@example.test', password: 'password' }, 'http://evil.test')).status, 403);
  assert.equal((await request('/admin/login', { email: 'admin@example.test', password: 'password' })).headers.get('location'), '/admin/mfa');
  assert.ok(cookies.size);
  const beforeMfa = await request('/admin/');
  assert.equal(beforeMfa.headers.get('location'), '/admin/mfa', `status ${beforeMfa.status}: ${await beforeMfa.text()}`);
  assert.equal((await request('/admin/enquiries/')).headers.get('location'), '/admin/mfa');
  const enrollment = await request('/admin/mfa', { action: 'enroll' });
  assert.equal(enrollment.status, 200);
  assert.match(await enrollment.text(), /TESTSECRET/);
  const verified = await request('/admin/mfa', { action: 'verify', factor: factorId, code: '123456' });
  assert.equal(verified.headers.get('location'), '/admin/');
  const dashboard = await request('/admin/');
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Enquiry administration/);
  const enquiries = await request('/admin/enquiries/');
  const enquiryHtml = await enquiries.text();
  assert.equal(enquiries.status, 200);
  assert.match(enquiryHtml, /Test Enquirer/);
  assert.match(enquiryHtml, /Please contact me\./);
  assert.match(enquiryHtml, /Notification delivery/);
  assert.match(enquiryHtml, /503/);
  const changedStatus = await request('/admin/enquiries/', { action: 'status', id: enquiryId, status: 'read' });
  assert.equal(changedStatus.headers.get('location'), '/admin/enquiries/');
  assert.equal(enquiryStatus, 'read');
  assert.equal((await request('/admin/logout', {}, 'http://evil.test')).status, 403);
  assert.equal((await request('/admin/logout', {})).headers.get('location'), '/admin/login');
  assert.equal((await request('/admin/')).headers.get('location'), '/admin/login');
});
