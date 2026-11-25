import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  archiveSiteContent,
  createSiteContentDraft,
  parseSiteContentArchive,
  parseSiteContentDraft,
  parseSiteContentTransition,
  reviseSiteContentDraft,
  transitionSiteContent,
} from '../src/server/admin-site-content/workflow.ts';
import { SITE_CONTENT_ROUTES, siteContentRouteKind } from '../src/server/site-content/routes.ts';

const item = '11111111-1111-4111-8111-111111111111';
const revision = '22222222-2222-4222-8222-222222222222';
const form = (values) => new URLSearchParams(values);

function draftForm(kind = 'area', action = 'new') {
  const values = {
    action, kind,
    slug: kind === 'area' ? 'buy-property-amwaj-island' : kind === 'project' ? 'projects' :
      kind === 'landing' ? 'bahrain-residency' : 'site-title',
    route_path: kind === 'area' ? '/buy-property/amwaj-island/' :
      kind === 'project' ? '/projects/' : kind === 'landing' ? '/bahrain-residency/' : '',
    locale: 'en', title: 'Amwaj Islands',
    body: 'Private editorial notes', summary: '', seo_title: '', seo_description: '',
  };
  if (action === 'draft') {
    delete values.slug;
    delete values.route_path;
    values.revision = revision;
  }
  return form(values);
}

test('site content drafts accept routed area, project, landing and private setting kinds', () => {
  for (const kind of ['area', 'project', 'landing', 'setting']) {
    assert.ok(parseSiteContentDraft(draftForm(kind), 'new'));
  }
  assert.equal(parseSiteContentDraft(draftForm('area', 'draft'), 'draft').locale, 'en');
  const invalidKind = draftForm();
  invalidKind.set('kind', 'article');
  assert.equal(parseSiteContentDraft(invalidKind, 'new'), null);
  const invalidSlug = draftForm();
  invalidSlug.set('slug', '../amwaj');
  assert.equal(parseSiteContentDraft(invalidSlug, 'new'), null);
  const duplicateField = draftForm();
  duplicateField.append('body', 'tampered');
  assert.equal(parseSiteContentDraft(duplicateField, 'new'), null);
  const extraField = draftForm();
  extraField.set('published', 'true');
  assert.equal(parseSiteContentDraft(extraField, 'new'), null);
  const mismatchedRoute = draftForm('area');
  mismatchedRoute.set('route_path', '/rent-property/tala-island/');
  assert.equal(parseSiteContentDraft(mismatchedRoute, 'new'), null);
  const inventedRoute = draftForm('landing');
  inventedRoute.set('slug', 'unapproved-page');
  inventedRoute.set('route_path', '/unapproved-page/');
  assert.equal(parseSiteContentDraft(inventedRoute, 'new'), null);
  assert.equal(siteContentRouteKind('/projects/'), 'project');
  assert.equal(siteContentRouteKind('/buy-property/amwaj-island/'), 'area');
  assert.equal(siteContentRouteKind('/bahrain-residency/'), 'landing');
});

test('all workbook buy-property targets are represented in the immutable CMS route catalog', async () => {
  const map = await readFile(new URL('../docs/keyword-map.md', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../supabase/migrations/20261125000200_site_content_publication.sql', import.meta.url), 'utf8');
  const mappedBuyPaths = [...new Set(map.match(/`(\/buy-property\/[^`]+)`/g) ?? [])]
    .map((value) => value.slice(1, -1));
  assert.ok(mappedBuyPaths.length > 0);
  for (const path of mappedBuyPaths) assert.ok(SITE_CONTENT_ROUTES.includes(path), path);
  const allowedPaths = [...migration.matchAll(/\('([^']+)', '(?:area|project|landing)'\)/g)]
    .map(([, path]) => path);
  assert.deepEqual(new Set(allowedPaths), new Set(SITE_CONTENT_ROUTES));
});

test('site content transitions require confirmation, valid locale revision and CAS publication state', () => {
  assert.deepEqual(parseSiteContentTransition(form({
    action: 'review', revision, confirm: 'yes',
  }), 'review'), { revision, expected: null });
  assert.deepEqual(parseSiteContentTransition(form({
    action: 'publish', revision, expected: 'none', confirm: 'yes',
  }), 'publish'), { revision, expected: null });
  assert.deepEqual(parseSiteContentTransition(form({
    action: 'unpublish', revision, expected: item, confirm: 'yes',
  }), 'unpublish'), { revision, expected: item });
  assert.equal(parseSiteContentTransition(form({
    action: 'publish', revision, expected: 'none',
  }), 'publish'), null);
  assert.equal(parseSiteContentTransition(form({
    action: 'publish', revision, expected: item, confirm: 'yes', force: 'true',
  }), 'publish'), null);
});

test('site content archival is confirmed and compare-and-swap guarded', () => {
  assert.deepEqual(
    parseSiteContentArchive(form({
      action: 'archive', item_id: item, expected_archived: 'false', archived: 'true', confirm: 'yes',
    })),
    { item_id: item, expected_archived: false, archived: true },
  );
  assert.deepEqual(
    parseSiteContentArchive(form({
      action: 'archive', item_id: item, expected_archived: 'true', archived: 'false', confirm: 'yes',
    })),
    { item_id: item, expected_archived: true, archived: false },
  );
  assert.equal(parseSiteContentArchive(form({
    action: 'archive', item_id: item, expected_archived: 'false', archived: 'false', confirm: 'yes',
  })), null);
  assert.equal(parseSiteContentArchive(form({
    action: 'archive', item_id: item, expected_archived: 'false', archived: 'true',
  })), null);
});

test('create, revise, archive and restore operations use atomic database RPCs', async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: null, error: null };
    },
  };
  await createSiteContentDraft(client, parseSiteContentDraft(draftForm('project'), 'new'));
  await reviseSiteContentDraft(client, parseSiteContentDraft(draftForm('project', 'draft'), 'draft'));
  await archiveSiteContent(client, parseSiteContentArchive(form({
    action: 'archive', item_id: item, expected_archived: 'false', archived: 'true', confirm: 'yes',
  })));
  assert.deepEqual(calls.map(({ name }) => name), [
    'create_routed_site_content_draft',
    'revise_site_content_draft',
    'set_site_content_archived',
  ]);
  assert.equal(calls[0].args.p_kind, 'project');
  assert.equal(calls[0].args.p_route_path, '/projects/');
  assert.equal(calls[1].args.p_expected_kind, 'project');
  assert.equal(calls[2].args.p_expected_archived, false);
  assert.equal(calls[2].args.p_archived, true);
});

test('public site-content transitions call the secured compare-and-swap RPCs', async () => {
  const calls = [];
  const revisionRow = {
    id: revision, item_id: item, kind: 'area', locale: 'en', title: 'Amwaj',
  };
  const itemRow = {
    id: item, kind: 'area', slug: 'buy-property-amwaj-island',
    route_path: '/buy-property/amwaj-island/', archived_at: null,
  };
  const client = {
    from(table) {
      const query = {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          if (table === 'site_content_revisions') return { data: revisionRow, error: null };
          if (table === 'site_content_items') return { data: itemRow, error: null };
          if (table === 'site_content_publications') return { data: { revision_id: item }, error: null };
          return { data: null, error: null };
        },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: null, error: null };
    },
  };
  const input = parseSiteContentTransition(form({
    action: 'publish', revision, expected: item, confirm: 'yes',
  }), 'publish');
  assert.equal(await transitionSiteContent(client, 'publish', input), true);
  assert.deepEqual(calls, [{
    name: 'publish_site_content_revision',
    args: { p_revision_id: revision, p_expected_revision_id: item },
  }]);
});

test('site content admin route enforces AAL2, origin, CSRF and exact-revision publication steps', async () => {
  const route = await readFile(new URL('../src/pages/admin/site-content/index.astro', import.meta.url), 'utf8');
  assert.match(route, /validMutation\(Astro\.request, config\.origin\)/);
  assert.match(route, /validCsrfToken\(form, Astro\.cookies\)/);
  assert.match(route, /await membership\(client\)/);
  assert.match(route, /await mfaState\(client\)/);
  assert.match(route, /!mfa\.authorized/);
  assert.match(route, /protectResponse\(Astro\.response\)/);
  assert.match(route, /readForm\(Astro\.request, 220000\)/);
  assert.match(route, /archived/);
  assert.match(route, /createSiteContentDraft/);
  assert.match(route, /Arabic exact-revision human review/);
  assert.match(route, /value="publish"/);
  assert.doesNotMatch(route, /set:html/);
});

test('site content database stays private, immutable and audited', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261124000400_editorial.sql', import.meta.url), 'utf8');
  const publishing = await readFile(new URL('../supabase/migrations/20261125000200_site_content_publication.sql', import.meta.url), 'utf8');
  assert.match(migration, /create table public\.site_content_items/);
  assert.match(migration, /create table public\.site_content_revisions/);
  assert.match(migration, /immutable_site_content_revisions/);
  assert.match(migration, /audit_site_content_items/);
  assert.match(migration, /audit_site_content_revisions/);
  assert.match(migration, /create function public\.create_site_content_draft/);
  assert.match(migration, /create function public\.revise_site_content_draft/);
  assert.match(migration, /create function public\.set_site_content_archived/);
  assert.match(migration, /site_content_items_admin_read/);
  assert.match(migration, /site_content_revisions_admin_read/);
  assert.match(publishing, /create view public\.published_site_content/);
  assert.match(publishing, /create function public\.publish_site_content_revision/);
  assert.match(publishing, /create function public\.unpublish_site_content/);
  assert.match(publishing, /Exact Arabic revision requires human review/);
  assert.match(publishing, /site_content_route_allowlist/);
  assert.match(publishing, /revoke all on public\.site_content_reviews/);
  const routes = await readFile(new URL('../src/server/site-content/routes.ts', import.meta.url), 'utf8');
  assert.match(routes, /'\/rent-property\/'/);
  assert.match(routes, /'\/projects\/'/);
  assert.match(routes, /'\/bahrain-residency\/golden-visa-bahrain\/'/);
});
