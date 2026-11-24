import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDraft, createNewDraft, parseDraft, parseNewDraft, parseTransition, transition } from '../src/server/admin-properties/workflow.ts';

const id = '11111111-1111-4111-8111-111111111111';
const item = '22222222-2222-4222-8222-222222222222';
const version = '33333333-3333-4333-8333-333333333333';
const other = '44444444-4444-4444-8444-444444444444';

function form(values) { return new URLSearchParams(values); }
function newForm() {
  return form({ action: 'new', slug: 'example', locale: 'en', transaction_type: 'sale', availability: 'available',
    price_bhd: '123.456', bedrooms: '2', bathrooms: '', size_square_meters: '100.25',
    location_name: 'Location', title: 'Title', body: 'Description', area_name: 'Area',
    property_type: 'Apartment', seo_title: '', seo_description: '' });
}
function draftForm() {
  return form({ action: 'draft', revision: id, locale: 'ar', title: 'Title', body: 'Body',
    summary: '', area_name: 'Area', property_type: 'Type', seo_title: '', seo_description: '' });
}
function clientFor(kind = 'property') {
  const calls = [];
  const rows = {
    content_revisions: { id, item_id: item, property_version_id: version },
    content_items: kind === 'property' ? { id: item, kind, slug: 'example' } : null,
    property_versions: { id: version },
  };
  return {
    calls,
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; },
        async maybeSingle() { return { data: rows[table], error: null }; },
        insert(value) { calls.push(['insert', table, value]); return query; },
        async single() { return { data: { id: other }, error: null }; },
      };
      return query;
    },
    async rpc(name, args) { calls.push(['rpc', name, args]); return { error: null }; },
  };
}

test('new draft validation bounds values and rejects duplicates and invalid numbers', () => {
  assert.ok(parseNewDraft(newForm()));
  for (const [field, value] of [['price_bhd', '-1'], ['price_bhd', '1e5'], ['price_bhd', '1.0001'],
    ['size_square_meters', '0'], ['bedrooms', '10001'], ['slug', '../bad'], ['body', '  '], ['locale', 'fr']]) {
    const input = newForm();
    input.set(field, value);
    assert.equal(parseNewDraft(input), null, field);
  }
  const duplicate = newForm();
  duplicate.append('title', 'other');
  assert.equal(parseNewDraft(duplicate), null);
  const extra = newForm();
  extra.set('created_by', id);
  assert.equal(parseNewDraft(extra), null);
});

test('creation uses one atomic RPC and no direct writes', async () => {
  const client = clientFor();
  const created = await createNewDraft(client, parseNewDraft(newForm()));
  assert.match(created, /^[a-f0-9-]{36}$/);
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0][1], 'create_property_draft');
  assert.equal(client.calls[0][2].p_revision_id, created);
  assert.equal(client.calls[0][2].p_price_bhd, '123.456');
});

test('existing property draft is one immutable revision and cannot target articles', async () => {
  const parsed = parseDraft(draftForm());
  assert.ok(parsed);
  const client = clientFor();
  assert.equal(await createDraft(client, id, parsed), other);
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0][1], 'content_revisions');
  assert.equal(client.calls[0][2].property_version_id, version);
  assert.equal(client.calls[0][2].created_by, id);
  assert.equal(await createDraft(clientFor('article'), id, parsed), null);
  const invalid = draftForm();
  invalid.set('body', '\0');
  assert.equal(parseDraft(invalid), null);
});

test('approval and CAS publication require confirmation and scoped property revision', async () => {
  const approve = parseTransition(form({ action: 'approve', revision: id, confirm: 'yes' }), 'approve');
  const publish = parseTransition(form({ action: 'publish', revision: id, confirm: 'yes', expected: other }), 'publish');
  assert.ok(approve);
  assert.ok(publish);
  assert.equal(parseTransition(form({ action: 'approve', revision: id }), 'approve'), null);
  assert.equal(parseTransition(form({ action: 'publish', revision: id, confirm: 'yes', expected: 'bad' }), 'publish'), null);
  const client = clientFor();
  assert.equal(await transition(client, 'approve', approve), true);
  assert.equal(await transition(client, 'publish', publish), true);
  assert.deepEqual(client.calls.map((call) => call[1]), ['approve_revision', 'publish_revision_if_current']);
  assert.equal(client.calls[1][2].p_expected_revision_id, other);
  const notProperty = clientFor('article');
  assert.equal(await transition(notProperty, 'approve', approve), false);
  assert.equal(notProperty.calls.length, 0);
});

test('provider errors are not mistaken for successful changes', async () => {
  const client = clientFor();
  client.rpc = async () => ({ error: new Error('conflict') });
  await assert.rejects(createNewDraft(client, parseNewDraft(newForm())));
  await assert.rejects(transition(client, 'publish', parseTransition(form({ action: 'publish', revision: id, expected: 'none', confirm: 'yes' }), 'publish')));
});

test('route independently applies origin, identity, MFA, and response protections', async () => {
  const route = await readFile(new URL('../src/pages/admin/properties/index.astro', import.meta.url), 'utf8');
  assert.match(route, /validMutation\(Astro\.request, config\.origin\)/);
  assert.match(route, /await membership\(client\)/);
  assert.match(route, /await mfaState\(client\)/);
  assert.match(route, /!mfa\.authorized/);
  assert.match(route, /protectResponse\(Astro\.response\)/);
  assert.doesNotMatch(route, /set:html/);
});
