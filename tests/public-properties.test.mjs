import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createPortProbe } from 'node:net';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const id = 'a1111111-1111-4111-8111-111111111111';
const soldId = '22222222-2222-4222-8222-222222222222';
const revision = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row = (overrides = {}) => ({
  id, kind: 'property', slug: 'example-home', locale: 'en', revision_id: revision,
  published_at: '2026-01-01T00:00:00Z', title: 'Published <home>', body: 'Approved description',
  summary: null, seo_title: 'Reviewed listing SEO title', seo_description: 'Reviewed listing search description.',
  area_name: 'Reviewed area', property_type: 'Apartment', transaction_type: 'sale',
  availability: 'available', price_bhd: '99999999999.999', bedrooms: 2, bathrooms: 1,
  price_bhd_numeric: 99999999999.999, size_square_meters: 100.5,
  location_name: 'Reviewed location', ...overrides,
});
const rows = [
  row(), row({ id: soldId, slug: 'sold-home', availability: 'sold', title: 'Sold property' }),
  row({ id, locale: 'ar', title: 'عقار منشور', body: 'وصف منشور' }),
  row({
    id: '55555555-5555-4555-8555-555555555555',
    revision_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    slug: 'related-sale',
    title: 'Related sale',
  }),
  ...Array.from({ length: 21 }, (_, index) => row({
    id: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    slug: `rent-home-${index}`, transaction_type: 'rent', bedrooms: 3,
    title: `Rental ${index}`,
  })),
];
let backend;
let configured;
let unconfigured;
let base;
let missingBase;
let backendError = false;
let invalidPrice = false;
let requests = [];
let mediaRecords = [];

async function unusedPort() {
  const probe = createPortProbe();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function start(env) {
  const port = await unusedPort();
  const child = spawn(join(root, 'node_modules/.bin/astro'), ['dev', '--ignore-lock', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { output += data; });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`Astro exited before becoming ready: ${output}`);
    try { await fetch(url); return [child, url]; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  child.kill();
  throw new Error('Astro did not start');
}

before(async () => {
  backend = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    requests.push({ path: url.pathname, params: url.searchParams, key: request.headers.apikey });
    response.setHeader('content-type', 'application/json');
    if (backendError) { response.writeHead(500); response.end(JSON.stringify({ message: 'private error' })); return; }
    let result = url.pathname.endsWith('/published_content_media')
      ? mediaRecords.filter((item) => {
        const locale = url.searchParams.get('locale');
        const revisionIds = url.searchParams.get('revision_id');
        return (!locale || locale === `eq.${item.locale}`) &&
          (!revisionIds || revisionIds.includes(item.revision_id));
      })
      : rows.filter((item) => {
      for (const [key, value] of url.searchParams) {
        if (value.startsWith('eq.') && String(item[key]) !== value.slice(3)) return false;
        if (value.startsWith('neq.') && String(item[key]) === value.slice(4)) return false;
        if (value.startsWith('not.eq.') && String(item[key]) === value.slice(7)) return false;
        if (value.startsWith('gte.') && !(item[key] >= Number(value.slice(4)))) return false;
        if (value.startsWith('lte.') && !(item[key] <= Number(value.slice(4)))) return false;
        if (value.startsWith('ilike.') && !String(item[key]).toLowerCase().includes(value.slice(6).replaceAll('%', '').toLowerCase())) return false;
        if (key === 'availability' && value.startsWith('in.') && !['available', 'reserved'].includes(item.availability)) return false;
        if (key === 'or' && !value.slice(1, -1).split(',').some((term) => {
          const match = /^(title|area_name|location_name)\.ilike\.%(.+)%$/.exec(term);
          return match && String(item[match[1]]).toLowerCase().includes(match[2].toLowerCase());
        })) return false;
      }
      return true;
    });
    if (invalidPrice) result = result.map((item) => ({ ...item, price_bhd: 99999999999.999 }));
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? result.length);
    result = result.slice(offset, offset + limit);
    response.end(JSON.stringify(result));
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  [configured, base] = await start({
    SUPABASE_URL: `http://127.0.0.1:${backend.address().port}`,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  });
});

after(async () => {
  for (const child of [configured, unconfigured]) {
    if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  }
  if (backend) await new Promise((resolve) => backend.close(resolve));
});

async function read(path, host = base) {
  const response = await fetch(`${host}${path}`, { redirect: 'manual' });
  const html = await response.text();
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  return { response, html };
}

function latestPropertyQuery() {
  return requests.findLast((request) => request.path.endsWith('/published_content'));
}

test('listing is bounded, filtered, linked, locale-specific and only queries the public view', async () => {
  requests = [];
  const { response, html } = await read('/properties/?transaction=rent&bedrooms=3');
  assert.equal(response.status, 200);
  assert.match(html, /Rental 0/);
  assert.doesNotMatch(html, /Rental 20|Sold property|Published &lt;home&gt;/);
  assert.match(html, /page=2/);
  assert.match(html, /\/properties\/rent-home-0-30000000-0000-4000-8000-000000000000\//);
  const query = latestPropertyQuery();
  assert.equal(query.path, '/rest/v1/published_content');
  assert.equal(query.key, 'sb_publishable_test');
  assert.equal(query.params.get('kind'), 'eq.property');
  assert.equal(query.params.get('locale'), 'eq.en');
  assert.equal(query.params.get('availability'), 'in.(available,reserved)');
  assert.equal(query.params.get('limit'), '21');
  assert.equal(query.params.get('transaction_type'), 'eq.rent');
  assert.equal(query.params.get('bedrooms'), 'gte.3');
  const second = await read('/properties/?transaction=rent&bedrooms=3&page=2');
  assert.match(second.html, /Rental 20/);
  const ar = await read('/ar/properties/');
  assert.match(ar.html, /عقار منشور/);
  assert.doesNotMatch(ar.html, /Rental 0|Published &lt;home&gt;/);
});

test('details use exact slug and ID, preserve sold pages and do not fall back across locales', async () => {
  const en = await read(`/properties/example-home-${id}/`);
  assert.equal(en.response.status, 200);
  assert.match(en.html, /<title>Reviewed listing SEO title<\/title>/);
  assert.match(en.html, /<meta name="description" content="Reviewed listing search description\."\/?>/);
  assert.match(en.html, /Published &lt;home&gt;/);
  assert.match(en.html, /Approved description/);
  assert.match(en.html, /BHD|BD/);
  assert.match(en.html, /99,999,999,999\.999/);
  assert.match(en.html, /Related properties/);
  assert.match(en.html, /Related sale/);
  const sold = await read(`/properties/sold-home-${soldId}/`);
  assert.equal(sold.response.status, 200);
  assert.match(sold.html, /Sold property/);
  assert.match(sold.html, />Sold</);
  const ar = await read(`/ar/properties/example-home-${id}/`);
  assert.equal(ar.response.status, 200);
  assert.match(ar.html, /عقار منشور/);
  assert.doesNotMatch(ar.html, /Approved description/);
  for (const path of [
    `/ar/properties/sold-home-${soldId}/`, `/properties/wrong-${id}/`,
    `/properties/example-home-not-a-uuid/`, `/properties/example-home-${id.toUpperCase()}/`,
  ]) assert.equal((await read(path)).response.status, 404, path);
});

test('only localized published gallery images are rendered on listings and details', async () => {
  mediaRecords = [{
    id: '44444444-4444-4444-8444-444444444444',
    revision_id: revision,
    locale: 'en',
    alt_text: 'Reviewed exterior',
    position: 0,
    is_cover: true,
    mime_type: 'image/webp',
    width: 1200,
    height: 900,
  }];
  try {
    const listing = await read('/properties/');
    assert.match(listing.html, /src="\/api\/media\/44444444-4444-4444-8444-444444444444"/);
    assert.match(listing.html, /alt="Reviewed exterior"/);
    const detail = await read(`/properties/example-home-${id}/`);
    assert.match(detail.html, /Reviewed exterior/);
    const arabic = await read(`/ar/properties/example-home-${id}/`);
    assert.doesNotMatch(arabic.html, /Reviewed exterior/);
  } finally {
    mediaRecords = [];
  }
});

test('invalid inputs are rejected without backend queries', async () => {
  for (const query of [
    'page=0', 'page=51', 'page=1&page=2', 'bedrooms=-1', 'bedrooms=11',
    'transaction=sold', 'unknown=x', 'minimumPrice=-1', 'minimumPrice=2&maximumPrice=1',
    'minimumPrice=1.0001', 'sort=unsupported', 'q=unsafe%2Cfilter',
  ]) {
    requests = [];
    assert.equal((await read(`/properties/?${query}`)).response.status, 400, query);
    assert.equal(requests.length, 0);
  }
});

test('listing search applies bounded text and exact decimal price criteria with stable sort', async () => {
  requests = [];
  const { response, html } = await read('/properties/?q=Manama&location=Reviewed&propertyType=Apartment&minimumPrice=100.125&maximumPrice=99999999999.999&sort=price_asc');
  assert.equal(response.status, 200);
  assert.match(html, /name="q" value="Manama"/);
  const query = latestPropertyQuery();
  assert.equal(query.params.get('or'), '(title.ilike.%Manama%,area_name.ilike.%Manama%,location_name.ilike.%Manama%)');
  assert.equal(query.params.get('location_name'), 'ilike.%Reviewed%');
  assert.equal(query.params.get('property_type'), 'ilike.%Apartment%');
  assert.equal(query.params.get('price_bhd_numeric'), 'gte.100.125');
  assert.equal(query.params.get('order'), 'price_bhd_numeric.asc.nullslast,id.asc');
});

test('missing configuration and backend failures return 503 rather than empty results or 404', async () => {
  invalidPrice = true;
  try { assert.equal((await read(`/properties/example-home-${id}/`)).response.status, 503); }
  finally { invalidPrice = false; }
  backendError = true;
  try {
    for (const path of ['/properties/', `/properties/example-home-${id}/`]) {
      const { response, html } = await read(path);
      assert.equal(response.status, 503);
      assert.doesNotMatch(html, /private error/);
    }
  } finally { backendError = false; }
  configured.kill();
  await once(configured, 'exit');
  [unconfigured, missingBase] = await start({ SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' });
  assert.equal((await read('/properties/', missingBase)).response.status, 503);
  assert.equal((await read(`/properties/example-home-${id}/`, missingBase)).response.status, 503);
});
