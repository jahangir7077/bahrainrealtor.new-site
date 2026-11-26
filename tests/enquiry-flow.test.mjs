import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createPortProbe } from 'node:net';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { serviceBackendSettings, enquiryRateLimitKey } from '../src/server/enquiries/backend.ts';
import { enquiryConsentText } from '../src/server/enquiries/consent.ts';
import { parseEnquiryStatusUpdate } from '../src/server/enquiries/admin.ts';
import {
  notificationEndpoint,
  resolvePublicNotificationAddress,
} from '../src/server/enquiries/notifications.ts';
import { readBoundedEnquiryJson } from '../src/server/enquiries/validation.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const propertyId = 'a1111111-1111-4111-8111-111111111111';
const serviceKey = [
  Buffer.from('{"alg":"none"}').toString('base64url'),
  Buffer.from('{"role":"service_role"}').toString('base64url'),
  'unit-test-only',
].join('.');
const valid = {
  name: 'مريم',
  email: 'person@example.com',
  telephone: '',
  message: 'Please contact me.',
  propertyReference: propertyId,
  language: 'ar',
  consent: true,
};
let backend;
let astro;
let base;
let rateAllowed = true;
let propertyPublished = true;
let calls = [];
let inserted;

async function unusedPort() {
  const probe = createPortProbe();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body;
}

before(async () => {
  backend = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const body = await readBody(request);
    calls.push({ path: url.pathname, method: request.method, body, apikey: request.headers.apikey });
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/rest/v1/rpc/consume_enquiry_rate_limit') {
      response.end(JSON.stringify(rateAllowed));
    } else if (url.pathname === '/rest/v1/rpc/is_enquiry_property_published') {
      response.end(JSON.stringify(propertyPublished));
    } else if (url.pathname === '/rest/v1/enquiries' && request.method === 'POST') {
      inserted = JSON.parse(body);
      response.writeHead(201);
      response.end();
    } else {
      response.writeHead(404);
      response.end(JSON.stringify({ message: 'not found' }));
    }
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');

  const port = await unusedPort();
  base = `http://127.0.0.1:${port}`;
  astro = spawn(join(root, 'node_modules/.bin/astro'), [
    'dev', '--ignore-lock', '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  ], {
    cwd: root,
    env: {
      ...process.env,
      APP_ORIGIN: base,
      SUPABASE_URL: `http://127.0.0.1:${backend.address().port}`,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      ENQUIRY_RATE_LIMIT_SECRET: 'test-rate-limit-secret-not-a-credential',
      ENQUIRY_WORKER_TOKEN: 'worker-token-test-value-not-a-credential',
    },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (astro.exitCode !== null) throw new Error('Astro enquiry test server exited');
    try { await fetch(base); return; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  throw new Error('Astro enquiry test server did not start');
});

after(async () => {
  if (astro && astro.exitCode === null) { astro.kill(); await once(astro, 'exit'); }
  if (backend) await new Promise((resolve) => backend.close(resolve));
});

async function submit(data = valid, headers = {}) {
  return fetch(`${base}/api/enquiries`, {
    method: 'POST',
    headers: {
      origin: base,
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  });
}

test('public endpoint requires exact same-origin JSON and records server-owned consent', async () => {
  calls = [];
  inserted = undefined;
  const denied = await submit(valid, { origin: 'https://other.example' });
  assert.equal(denied.status, 403);
  assert.match(denied.headers.get('cache-control'), /no-store/);
  assert.match(denied.headers.get('x-robots-tag'), /noindex/);
  assert.equal(calls.length, 0);

  const mediaType = await submit(valid, { 'content-type': 'text/plain' });
  assert.equal(mediaType.status, 415);
  assert.equal(calls.length, 0);

  const response = await submit();
  assert.equal(response.status, 201);
  assert.match(await response.text(), /received/);
  assert.equal(inserted.locale, 'ar');
  assert.equal(inserted.property_item_id, propertyId);
  assert.equal(inserted.consent, true);
  assert.equal(inserted.consent_text, enquiryConsentText.ar);
  assert.notEqual(inserted.consent_text, valid.consent);
  const rateRequest = calls.find((call) => call.path.endsWith('/consume_enquiry_rate_limit'));
  assert.match(JSON.parse(rateRequest.body).p_bucket_key, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(rateRequest.body, /127\.0\.0\.1/);
  assert.equal(rateRequest.apikey, serviceKey);
});

test('public endpoint fails closed for rate limiting, unpublished properties and malformed input', async () => {
  rateAllowed = false;
  calls = [];
  assert.equal((await submit()).status, 429);
  assert.equal(calls.some((call) => call.path.endsWith('/enquiries')), false);
  rateAllowed = true;

  propertyPublished = false;
  calls = [];
  assert.equal((await submit()).status, 422);
  assert.equal(calls.some((call) => call.path.endsWith('/enquiries')), false);
  propertyPublished = true;

  calls = [];
  assert.equal((await submit({ ...valid, consent: false })).status, 400);
  assert.equal(calls.some((call) => call.path.endsWith('/enquiries')), false);
  const hidden = await submit({ ...valid, honeypot: 'automated entry' });
  assert.equal(hidden.status, 202);
  assert.equal(calls.some((call) => call.path.endsWith('/enquiries')), false);
});

test('database settings, HMAC client keys, admin status parsing and consent are constrained', () => {
  const env = {
    SUPABASE_URL: 'https://project.example',
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  };
  assert.ok(serviceBackendSettings(env));
  assert.equal(serviceBackendSettings({ ...env, SUPABASE_URL: 'https://project.example/path' }), null);
  assert.equal(serviceBackendSettings({ ...env, SUPABASE_URL: 'http://remote.example' }), null);
  assert.equal(serviceBackendSettings({ ...env, SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_not_secret' }), null);
  const key = enquiryRateLimitKey('127.0.0.1', 'a sufficiently long local test secret');
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(enquiryRateLimitKey('not-an-ip', 'a sufficiently long local test secret'), null);
  assert.equal(enquiryRateLimitKey('127.0.0.1', 'short'), null);
  assert.notEqual(enquiryConsentText.en, enquiryConsentText.ar);

  const id = 'a1111111-1111-4111-8111-111111111111';
  assert.deepEqual(parseEnquiryStatusUpdate(new URLSearchParams({ action: 'status', id, status: 'read' })), {
    id, status: 'read',
  });
  for (const fields of [
    { action: 'status', id, status: 'delete' },
    { action: 'status', id: 'not-a-uuid', status: 'read' },
    { action: 'status', id, status: 'read', unexpected: 'x' },
    { action: 'status', id, status: 'read', id2: id },
  ]) assert.equal(parseEnquiryStatusUpdate(new URLSearchParams(fields)), null);
});

test('notification endpoint rejects unsafe destinations and private DNS results', async () => {
  for (const value of [
    undefined, 'http://provider.example/send', 'https://127.0.0.1/send',
    'https://localhost/send', 'https://service.local/send', 'https://user@provider.example/send',
    'https://provider.example/send?token=in-url', 'https://provider.example./send',
  ]) assert.equal(notificationEndpoint(value), null, String(value));
  const endpoint = notificationEndpoint('https://provider.example/v1/receive');
  assert.ok(endpoint);
  assert.equal(await resolvePublicNotificationAddress(new URL('https://localhost/')), null);

  const unauthenticated = await fetch(`${base}/api/internal/enquiry-notifications`, { method: 'POST' });
  assert.equal(unauthenticated.status, 404);
  const unavailable = await fetch(`${base}/api/internal/enquiry-notifications`, {
    method: 'POST',
    headers: { authorization: ['Bearer', 'worker-token-test-value-not-a-credential'].join(' ') },
  });
  assert.equal(unavailable.status, 503);
});

test('bounded enquiry body rejects streams that do not complete in time', async () => {
  const hanging = new Request('https://example.test/', {
    method: 'POST',
    body: new ReadableStream({ start() {} }),
    duplex: 'half',
  });
  assert.deepEqual(await readBoundedEnquiryJson(hanging, 5), { ok: false, reason: 'invalid' });
});

test('migration implements atomic rate limiting and lease-based retry tracking', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261124000200_enquiry_flow.sql', import.meta.url), 'utf8');
  assert.match(migration, /on conflict \(bucket_key\) do update/i);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /create trigger enqueue_enquiry_notification after insert/i);
  assert.match(migration, /grant execute on function public\.claim_enquiry_notifications\(integer\) to service_role/i);
  assert.match(migration, /private\.validate_enquiry\(\)/i);
  assert.match(migration, /window_started_at <= now\(\) - interval '15 minutes'/i);
});

test('notification worker bounds batches below the two-minute database lease', async () => {
  const route = await readFile(new URL('../src/pages/api/internal/enquiry-notifications.ts', import.meta.url), 'utf8');
  assert.match(route, /NOTIFICATION_BATCH_SIZE = 4/);
  assert.match(route, /claim_enquiry_notifications', \{ p_limit: NOTIFICATION_BATCH_SIZE \}/);
});
