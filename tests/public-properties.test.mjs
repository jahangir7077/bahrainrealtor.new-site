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
const editorialRows = [
  ...['en', 'ar'].map((locale) => ({
    id: '66666666-6666-4666-8666-666666666666',
    kind: 'article',
    slug: 'amwaj-property-investment-guide',
    locale,
    revision_id: locale === 'en' ? '88888888-8888-4888-8888-888888888888' : '99999999-9999-4999-8999-999999999999',
    published_at: '2026-11-25T10:00:00Z',
    title: locale === 'en' ? 'Amwaj property investment guide' : 'دليل الاستثمار العقاري في أمواج',
    body: locale === 'en' ? 'Verified guide body.' : 'محتوى الدليل المعتمد.',
    summary: locale === 'en' ? 'A reviewed summary.' : 'ملخص تمت مراجعته.',
    author_name: 'Editorial team',
    seo_title: locale === 'en' ? 'Investing in Amwaj property' : 'الاستثمار في عقارات أمواج',
    seo_description: locale === 'en' ? 'Reviewed Amwaj investment information.' : 'معلومات مراجعة عن الاستثمار في أمواج.',
    category_slug: 'investment',
    category_name: locale === 'en' ? 'Investment' : 'الاستثمار',
  })),
  ...['en', 'ar'].map((locale) => ({
    id: locale === 'en' ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    kind: 'faq',
    slug: 'buying-property',
    locale,
    revision_id: locale === 'en' ? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' : 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    published_at: '2026-11-24T10:00:00Z',
    title: locale === 'en' ? 'How do I buy property?' : 'كيف أشتري عقاراً؟',
    body: locale === 'en' ? 'Review the verified buying process.' : 'راجع عملية الشراء المعتمدة.',
    summary: null,
    author_name: null,
    seo_title: null,
    seo_description: null,
    category_slug: 'buying',
    category_name: locale === 'en' ? 'Buying' : 'الشراء',
  })),
];
const siteContentRows = [
  ...['en', 'ar'].flatMap((locale) => [
    {
      id: locale === 'en' ? 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' : 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      kind: 'landing',
      slug: 'buy-property',
      route_path: '/buy-property/',
      locale,
      revision_id: locale === 'en' ? '12121212-1212-4212-8212-121212121212' : '13131313-1313-4313-8313-131313131313',
      published_at: '2026-11-20T10:00:00Z',
      title: locale === 'en' ? 'Buy property in Bahrain' : 'شراء عقار في البحرين',
      body: locale === 'en' ? 'Published buying overview.' : 'نظرة عامة منشورة عن الشراء.',
      summary: 'Reviewed summary',
      seo_title: locale === 'en' ? 'Buy Bahrain property' : 'شراء عقار البحرين',
      seo_description: locale === 'en' ? 'Reviewed buying guide.' : 'دليل شراء تمت مراجعته.',
    },
    {
      id: locale === 'en' ? '14141414-1414-4414-8414-141414141414' : '15151515-1515-4515-8515-151515151515',
      kind: 'area',
      slug: 'buy-property-amwaj-island',
      route_path: '/buy-property/amwaj-island/',
      locale,
      revision_id: locale === 'en' ? '16161616-1616-4616-8616-161616161616' : '17171717-1717-4717-8717-171717171717',
      published_at: '2026-11-21T10:00:00Z',
      title: locale === 'en' ? 'Property for sale in Amwaj Island' : 'عقارات للبيع في جزيرة أمواج',
      body: locale === 'en' ? 'Verified local guidance.' : 'إرشادات محلية معتمدة.',
      summary: 'Area summary',
      seo_title: null,
      seo_description: null,
    },
  ]),
];
let backend;
let configured;
let indexingEnabled;
let indexingBase;
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
      : (url.pathname.endsWith('/published_site_content')
        ? siteContentRows
        : url.pathname.endsWith('/published_editorial') ? editorialRows : rows).filter((item) => {
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
  [indexingEnabled, indexingBase] = await start({
    SUPABASE_URL: `http://127.0.0.1:${backend.address().port}`,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SEO_INDEXING_ENABLED: 'true',
  });
});

after(async () => {
  for (const child of [configured, indexingEnabled, unconfigured]) {
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

test('homepage search submits localized filters to published property listings', async () => {
  const { en } = await import('../src/i18n/translations/en.ts');
  const { ar } = await import('../src/i18n/translations/ar.ts');
  for (const [path, action, translations] of [['/', '/properties/', en], ['/ar/', '/ar/properties/', ar]]) {
    const response = await fetch(`${base}${path}`);
    const html = await response.text();
    assert.match(html, new RegExp(`<form method="get" action="${action}"`));
    for (const name of ['transaction', 'location', 'propertyType', 'minimumPrice', 'maximumPrice', 'bedrooms']) {
      assert.match(html, new RegExp(`name="${name}"`));
    }
    assert.match(html, /type="radio" name="transaction" value="sale" checked/);
    assert.match(html, /type="radio" name="transaction" value="rent"/);
    assert.match(html, /href="tel:\+97332083778"/);
    assert.match(html, /href="https:\/\/wa\.me\/97332083778"/);
    assert.ok(html.indexOf(translations.home.featuredTitle) > html.indexOf('search-panel'));
    for (const name of ['home', 'buyProperty', 'rentProperty', 'investBahrain', 'projects', 'financing', 'exploreAreas', 'marketInsights', 'aboutJahangir', 'hotDeals', 'blog', 'contact']) {
      assert.ok(html.includes(translations.navigation[name]), `missing ${name} navigation`);
    }
    assert.doesNotMatch(html, /non-submitting preview/);
  }
  const search = await read('/properties/?transaction=rent&location=&propertyType=&minimumPrice=&maximumPrice=&bedrooms=3');
  assert.equal(search.response.status, 200);
  assert.doesNotMatch(search.html, /Featured Properties|عقارات مميزة/);
  assert.match(search.html, /Rental 0/);
  assert.doesNotMatch(search.html, /Published &lt;home&gt;/);
});

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

test('sitemap and robots endpoints are served and indexing stays explicitly gated', async () => {
  const disabled = await fetch(`${base}/sitemap.xml`);
  assert.equal(disabled.status, 200);
  assert.match(disabled.headers.get('content-type'), /application\/xml/);
  assert.match(await disabled.text(), /<urlset/);
  assert.doesNotMatch(await (await fetch(`${base}/sitemap.xml`)).text(), /<url>/);
  const robotsOff = await (await fetch(`${base}/robots.txt`)).text();
  assert.match(robotsOff, /Disallow: \/admin\//);
  assert.doesNotMatch(robotsOff, /Sitemap:/);
  const enabled = await fetch(`${indexingBase}/sitemap.xml`);
  assert.equal(enabled.status, 200);
  const xml = await enabled.text();
  const sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, value]) => new URL(value));
  const hasSitemapPath = (path) => sitemapUrls.some((url) =>
    url.origin === 'https://bahrainrealtor.com' && url.pathname === path);
  assert.ok(hasSitemapPath(`/properties/example-home-${id}/`));
  assert.equal(hasSitemapPath(`/ar/properties/example-home-${id}/`), false);
  assert.ok(hasSitemapPath(`/properties/sold-home-${soldId}/`));
  assert.ok(hasSitemapPath('/guides/amwaj-property-investment-guide/'));
  assert.ok(hasSitemapPath('/blog/'));
  assert.ok(hasSitemapPath('/ar/blog/'));
  assert.ok(hasSitemapPath('/blog/articles/'));
  assert.ok(hasSitemapPath('/ar/blog/articles/'));
  assert.ok(hasSitemapPath('/blog/faqs/'));
  assert.ok(hasSitemapPath('/ar/blog/faqs/'));
  assert.ok(hasSitemapPath('/buy-property/'));
  assert.ok(hasSitemapPath('/ar/buy-property/'));
  assert.ok(hasSitemapPath('/buy-property/amwaj-island/'));
  assert.ok(hasSitemapPath('/ar/buy-property/amwaj-island/'));
  assert.ok(xml.includes('<lastmod>2026-11-25T10:00:00.000Z</lastmod>'));
  const robotsOn = await (await fetch(`${indexingBase}/robots.txt`)).text();
  assert.match(robotsOn, /Sitemap: https:\/\/bahrainrealtor\.com\/sitemap\.xml/);
  const property = await fetch(`${indexingBase}/properties/example-home-${id}/`);
  assert.equal(property.status, 200);
  const propertyHtml = await property.text();
  assert.match(propertyHtml, /<meta name="robots" content="index, follow"/);
  assert.match(propertyHtml, /<link rel="canonical" href="https:\/\/bahrainrealtor\.com\/properties\/example-home-/);
  assert.doesNotMatch(property.headers.get('x-robots-tag') ?? '', /noindex/);
  const arabicProperty = await fetch(`${indexingBase}/ar/properties/example-home-${id}/`);
  assert.equal(arabicProperty.status, 200);
  const arabicPropertyHtml = await arabicProperty.text();
  assert.match(arabicPropertyHtml, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(arabicPropertyHtml, /rel="canonical"/);
});

test('mapped area and landing pages render only published bilingual CMS content with SEO and internal links', async () => {
  const path = '/buy-property/amwaj-island/';
  const draftSafe = await fetch(`${base}${path}`);
  assert.equal(draftSafe.status, 200);
  const english = await draftSafe.text();
  assert.match(english, /Property for sale in Amwaj Island/);
  assert.match(english, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(english, /"@type":"WebPage"/);
  assert.match(english, /href="\/buy-property\/"/);
  const enabled = await fetch(`${indexingBase}${path}`);
  assert.equal(enabled.status, 200);
  const indexed = await enabled.text();
  assert.match(indexed, /<title>Property for sale in Amwaj Island<\/title>/);
  assert.match(indexed, /name="robots" content="index, follow"/);
  assert.match(indexed, /rel="canonical" href="https:\/\/bahrainrealtor\.com\/buy-property\/amwaj-island\/"/);
  assert.match(indexed, /hreflang="en-BH"/);
  assert.match(indexed, /hreflang="ar-BH"/);
  assert.match(indexed, /href="https:\/\/bahrainrealtor\.com\/ar\/buy-property\/amwaj-island\/"/);
  const arabic = await fetch(`${indexingBase}/ar${path}`);
  assert.equal(arabic.status, 200);
  assert.match(await arabic.text(), /عقارات للبيع في جزيرة أمواج/);
  assert.equal((await fetch(`${base}/buy-property/not-approved/`)).status, 404);
  assert.equal((await fetch(`${indexingBase}/rent-property/`)).status, 404);
});

test('bilingual blog hubs link only to published CMS archives and remain noindex by default', async () => {
  const english = await read('/blog/');
  assert.equal(english.response.status, 200);
  assert.match(english.html, /<h1[^>]*>Blog<\/h1>/);
  assert.match(english.html, /href="\/blog\/articles\/"/);
  assert.match(english.html, /href="\/blog\/faqs\/"/);
  assert.match(english.html, /noindex, nofollow/);
  const arabic = await read('/ar/blog/');
  assert.equal(arabic.response.status, 200);
  assert.match(arabic.html, /<h1[^>]*>المدونة<\/h1>/);
  assert.match(arabic.html, /href="\/ar\/blog\/articles\/"/);
  assert.match(arabic.html, /href="\/ar\/blog\/faqs\/"/);
  const enabled = await fetch(`${indexingBase}/blog/`);
  assert.equal(enabled.status, 200);
  const enabledHtml = await enabled.text();
  assert.match(enabledHtml, /name="robots" content="index, follow"/);
  assert.match(enabledHtml, /hreflang="en-BH"/);
  assert.match(enabledHtml, /hreflang="ar-BH"/);
  assert.match(enabledHtml, /href="https:\/\/bahrainrealtor\.com\/ar\/blog\/"/);
  const articleArchive = await fetch(`${indexingBase}/blog/articles/`);
  assert.equal(articleArchive.status, 200);
  const archiveHtml = await articleArchive.text();
  assert.match(archiveHtml, /hreflang="en-BH"/);
  assert.match(archiveHtml, /hreflang="ar-BH"/);
  assert.match(archiveHtml, /href="https:\/\/bahrainrealtor\.com\/ar\/blog\/articles\/"/);
});

test('bilingual guide routes use published CMS content, metadata, schema, and safe index gates', async () => {
  const path = '/guides/amwaj-property-investment-guide/';
  const draftSafe = await read(path);
  assert.equal(draftSafe.response.status, 200);
  assert.match(draftSafe.html, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(draftSafe.html, /A reviewed summary/);
  assert.doesNotMatch(draftSafe.html, /Development template preview/);
  const enabled = await fetch(`${indexingBase}${path}`);
  assert.equal(enabled.status, 200);
  const html = await enabled.text();
  assert.match(html, /<title>Investing in Amwaj property<\/title>/);
  assert.match(html, /<meta name="robots" content="index, follow"/);
  assert.match(html, /"@type":"Article"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /rel="canonical" href="https:\/\/bahrainrealtor\.com\/guides\/amwaj-property-investment-guide\/"/);
  assert.match(html, /hreflang="en-BH"/);
  assert.match(html, /hreflang="ar-BH"/);
  const arabic = await fetch(`${indexingBase}/ar${path}`);
  assert.equal(arabic.status, 200);
  const arabicHtml = await arabic.text();
  assert.match(arabicHtml, /الاستثمار في عقارات أمواج/);
  assert.match(arabicHtml, /href="https:\/\/bahrainrealtor\.com\/guides\/amwaj-property-investment-guide\/"/);
  for (const host of [base, indexingBase]) {
    const unavailable = await fetch(`${host}/guides/unpublished-guide/`);
    assert.equal(unavailable.status, 404);
    const unavailableHtml = await unavailable.text();
    assert.match(unavailableHtml, /<title>Article unavailable<\/title>/);
    assert.match(unavailableHtml, /name="description" content="This article is currently unavailable\."/);
    assert.match(unavailableHtml, /name="robots" content="noindex, nofollow"/);
  }
});

test('FAQ archives emit visible-content schema and auto-enter the sitemap only with content', async () => {
  const normal = await read('/blog/faqs/');
  assert.match(normal.html, /"@type":"FAQPage"/);
  assert.match(normal.html, /"name":"How do I buy property\?"/);
  assert.match(normal.html, /name="robots" content="noindex, nofollow"/);
  const enabled = await fetch(`${indexingBase}/blog/faqs/`);
  assert.equal(enabled.status, 200);
  const html = await enabled.text();
  assert.match(html, /name="robots" content="index, follow"/);
  assert.match(html, /rel="canonical" href="https:\/\/bahrainrealtor\.com\/blog\/faqs\/"/);
  assert.match(html, /hreflang="en-BH"/);
  assert.match(html, /hreflang="ar-BH"/);
});

test('details use exact slug and ID, preserve sold pages and do not fall back across locales', async () => {
  const en = await read(`/properties/example-home-${id}/`);
  assert.equal(en.response.status, 200);
  assert.match(en.html, /"@type":"BreadcrumbList"/);
  assert.match(en.html, /"item":"https:\/\/bahrainrealtor\.com\/properties\/example-home-/);
  assert.match(en.html, /<title>Reviewed listing SEO title<\/title>/);
  assert.match(en.html, /<meta name="description" content="Reviewed listing search description\."\/?>/);
  assert.doesNotMatch(en.html, /hreflang=/);
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
  const invalid = await read('/properties/?minimumPrice=5&maximumPrice=1');
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.html, /Invalid search filters\./);
  assert.match(invalid.html, /<form method="get" action="\/properties\/"/);
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
