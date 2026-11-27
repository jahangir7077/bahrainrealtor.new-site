import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createEditorialCategory,
  createEditorialDraft,
  parseEditorialCategory,
  parseEditorialDraft,
  parseEditorialTransition,
  reviseEditorialDraft,
} from '../src/server/admin-editorial/workflow.ts';
import { issueCsrfToken, readForm, validCsrfToken } from '../src/server/auth/security.ts';

const item = '11111111-1111-4111-8111-111111111111';
const revision = '22222222-2222-4222-8222-222222222222';
const category = '33333333-3333-4333-8333-333333333333';
const otherRevision = '44444444-4444-4444-8444-444444444444';
const form = (values) => new URLSearchParams(values);

function categoryForm() {
  return form({ action: 'category', kind: 'article', slug: 'guides', name_en: 'Guides', name_ar: 'أدلة' });
}

function articleForm(action = 'new') {
  const values = {
    action, kind: 'article', slug: 'property-guide',
    locale: 'en', category_id: category, title: 'Title', body: 'Full editorial body',
    summary: 'Short summary', author_name: 'Editorial team', seo_title: '', seo_description: '',
  };
  if (action === 'draft') {
    delete values.slug;
    values.revision = revision;
  }
  return form(values);
}

function faqForm(action = 'new') {
  const values = {
    action, kind: 'faq', slug: 'common-question',
    locale: 'ar', category_id: category, title: 'سؤال', body: 'إجابة',
    summary: '', author_name: '', seo_title: '', seo_description: '',
  };
  if (action === 'draft') {
    delete values.slug;
    values.revision = revision;
  }
  return form(values);
}

test('category and editorial draft validation reject malformed, duplicate and unrecognized fields', () => {
  assert.ok(parseEditorialCategory(categoryForm()));
  for (const [field, value] of [['kind', 'property'], ['slug', '../guides'], ['name_en', '  ']]) {
    const invalid = categoryForm();
    invalid.set(field, value);
    assert.equal(parseEditorialCategory(invalid), null, field);
  }
  const duplicate = categoryForm();
  duplicate.append('slug', 'another');
  assert.equal(parseEditorialCategory(duplicate), null);

  assert.ok(parseEditorialDraft(articleForm(), 'new'));
  assert.ok(parseEditorialDraft(faqForm(), 'new'), 'FAQ fields that are inapplicable may remain blank');
  assert.ok(parseEditorialDraft(faqForm('draft'), 'draft'), 'FAQ revision drafts do not require article fields');
  const missingArticleSummary = articleForm();
  missingArticleSummary.set('summary', '');
  assert.equal(parseEditorialDraft(missingArticleSummary, 'new'), null);
  for (const [field, value] of [['locale', 'fr'], ['slug', '../bad'], ['body', '\0']]) {
    const invalid = articleForm();
    invalid.set(field, value);
    assert.equal(parseEditorialDraft(invalid, 'new'), null, field);
  }
  const extra = faqForm();
  extra.set('created_by', item);
  assert.equal(parseEditorialDraft(extra, 'new'), null);
});

test('editorial transitions require explicit confirmation and compare exact publication revisions', () => {
  assert.ok(parseEditorialTransition(form({ action: 'approve', revision, confirm: 'yes' }), 'approve'));
  assert.ok(parseEditorialTransition(form({ action: 'review', revision, confirm: 'yes' }), 'review'));
  assert.deepEqual(
    parseEditorialTransition(form({ action: 'publish', revision, expected: 'none', confirm: 'yes' }), 'publish'),
    { revision, expected: null },
  );
  assert.deepEqual(
    parseEditorialTransition(form({ action: 'unpublish', revision, expected: otherRevision, confirm: 'yes' }), 'unpublish'),
    { revision, expected: otherRevision },
  );
  assert.equal(parseEditorialTransition(form({ action: 'review', revision }), 'review'), null);
  assert.equal(parseEditorialTransition(form({ action: 'publish', revision, expected: 'stale', confirm: 'yes' }), 'publish'), null);
  assert.equal(parseEditorialTransition(form({ action: 'unpublish', revision, expected: 'none', confirm: 'yes' }), 'unpublish'), null);
});

test('category, create and edit writes use atomic database functions only', async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: null, error: null };
    },
  };
  await createEditorialCategory(client, parseEditorialCategory(categoryForm()));
  const created = await createEditorialDraft(client, parseEditorialDraft(articleForm(), 'new'));
  const revised = await reviseEditorialDraft(client, parseEditorialDraft(faqForm('draft'), 'draft'));
  assert.match(created, /^[a-f0-9-]{36}$/);
  assert.match(revised, /^[a-f0-9-]{36}$/);
  assert.deepEqual(calls.map(({ name }) => name), [
    'create_editorial_category',
    'create_editorial_draft',
    'revise_editorial_draft',
  ]);
  assert.equal(calls[1].args.p_kind, 'article');
  assert.equal(calls[1].args.p_slug, 'property-guide');
  assert.equal(calls[2].args.p_locale, 'ar');
  assert.equal(calls[2].args.p_summary, null);
});

test('CSRF token is random, cookie-bound and requires a single exact form value', () => {
  const values = new Map();
  const cookies = {
    set(name, value, options) {
      values.set(name, { value, options });
    },
    get(name) {
      return values.get(name);
    },
  };
  const token = issueCsrfToken(cookies);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(validCsrfToken(form({ csrf: token }), cookies), true);
  const differentToken = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;
  assert.equal(validCsrfToken(form({ csrf: differentToken }), cookies), false);
  const duplicate = form({ csrf: token });
  duplicate.append('csrf', token);
  assert.equal(validCsrfToken(duplicate, cookies), false);
  assert.equal(values.get('__Host-br-csrf').options.httpOnly, true);
  assert.equal(values.get('__Host-br-csrf').options.sameSite, 'strict');
});

test('editorial form reader accepts bounded URL-encoded Arabic text while keeping the default cap', async () => {
  const body = new URLSearchParams({ body: 'م'.repeat(20000) }).toString();
  const makeRequest = () => new Request('https://example.invalid/admin/editorial/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  assert.equal(await readForm(makeRequest()), null);
  const parsed = await readForm(makeRequest(), 220000);
  assert.equal(parsed?.get('body'), 'م'.repeat(20000));
});

test('editorial route checks origin, CSRF, administrator membership and AAL2 on every mutation', async () => {
  const route = await readFile(new URL('../src/pages/admin/editorial/index.astro', import.meta.url), 'utf8');
  assert.match(route, /validMutation\(Astro\.request, config\.origin\)/);
  assert.match(route, /validCsrfToken\(form, Astro\.cookies\)/);
  assert.match(route, /readForm\(Astro\.request, 220000\)/);
  assert.match(route, /await membership\(client\)/);
  assert.match(route, /await mfaState\(client\)/);
  assert.match(route, /!mfa\.authorized/);
  assert.match(route, /protectResponse\(Astro\.response\)/);
  assert.doesNotMatch(route, /set:html/);
  for (const publicRoute of [
    '../src/pages/blog/articles/index.astro',
    '../src/pages/blog/faqs/index.astro',
    '../src/pages/ar/blog/articles/index.astro',
    '../src/pages/ar/blog/faqs/index.astro',
  ]) {
    const source = await readFile(new URL(publicRoute, import.meta.url), 'utf8');
    assert.match(source, /listPublished(?:Articles|Faqs)/);
    assert.match(source, /Astro\.response\.status = 503/);
    assert.match(source, /SEO_INDEXING_ENABLED === 'true'/);
    if (publicRoute.includes('/articles/')) {
      assert.match(source, /getPublicationEligibility\(publication, '(?:en|ar)'\)\.routeAvailable/);
    } else {
      assert.match(source, /getPublicationEligibility\(publication, '(?:en|ar)'\)\.routeAvailable/);
    }
    assert.doesNotMatch(source, /indexingEligible=\{true\}|enableCanonical=\{true\}/);
  }
});

test('database migration enforces exact Arabic review, immutable revisions and CAS unpublishing', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261124000400_editorial.sql', import.meta.url), 'utf8');
  assert.match(migration, /create function public\.create_editorial_draft/);
  assert.match(migration, /create function public\.revise_editorial_draft/);
  assert.match(migration, /create function public\.review_editorial_revision/);
  assert.match(migration, /Exact Arabic revision requires human review/);
  assert.match(migration, /create function public\.unpublish_editorial_content/);
  assert.match(migration, /p_expected_revision_id/);
  assert.match(migration, /immutable_editorial_metadata/);
  assert.match(migration, /create view public\.published_editorial/);
});
