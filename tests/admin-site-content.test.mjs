import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  archiveSiteContent,
  createSiteContentDraft,
  parseSiteContentArchive,
  parseSiteContentDraft,
  reviseSiteContentDraft,
} from '../src/server/admin-site-content/workflow.ts';

const item = '11111111-1111-4111-8111-111111111111';
const revision = '22222222-2222-4222-8222-222222222222';
const form = (values) => new URLSearchParams(values);

function draftForm(kind = 'area', action = 'new') {
  const values = {
    action, kind, slug: 'amwaj-island', locale: 'en', title: 'Amwaj Islands',
    body: 'Private editorial notes', summary: '', seo_title: '', seo_description: '',
  };
  if (action === 'draft') {
    delete values.slug;
    values.revision = revision;
  }
  return form(values);
}

test('site content drafts accept area, project and setting kinds with independent locales', () => {
  for (const kind of ['area', 'project', 'setting']) {
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
    'create_site_content_draft',
    'revise_site_content_draft',
    'set_site_content_archived',
  ]);
  assert.equal(calls[0].args.p_kind, 'project');
  assert.equal(calls[1].args.p_expected_kind, 'project');
  assert.equal(calls[2].args.p_expected_archived, false);
  assert.equal(calls[2].args.p_archived, true);
});

test('site content admin route enforces admin AAL2, origin, CSRF, and never offers publication', async () => {
  const route = await readFile(new URL('../src/pages/admin/site-content/index.astro', import.meta.url), 'utf8');
  assert.match(route, /validMutation\(Astro\.request, config\.origin\)/);
  assert.match(route, /validCsrfToken\(form, Astro\.cookies\)/);
  assert.match(route, /await membership\(client\)/);
  assert.match(route, /await mfaState\(client\)/);
  assert.match(route, /!mfa\.authorized/);
  assert.match(route, /protectResponse\(Astro\.response\)/);
  assert.match(route, /readForm\(Astro\.request, 220000\)/);
  assert.match(route, /archived/);
  assert.doesNotMatch(route, /value="publish"|publish_revision_if_current|set:html/);
});

test('site content database stays private, immutable and audited', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261124000400_editorial.sql', import.meta.url), 'utf8');
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
  assert.doesNotMatch(migration, /create view public\.published_site_content/);
});
