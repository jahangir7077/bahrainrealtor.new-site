import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { listMediaRevisions } from '../src/server/media/admin.ts';

const page = await readFile(new URL('../src/pages/admin/media/index.astro', import.meta.url), 'utf8');
const script = await readFile(new URL('../src/scripts/admin-media.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20261124000300_media.sql', import.meta.url), 'utf8');

test('media dashboard is admin/MFA protected, noindex, and lists content revisions', () => {
  assert.match(page, /membership\(client\)/);
  assert.match(page, /mfaState\(client\)/);
  assert.match(page, /!mfa\.authorized/);
  assert.match(page, /listMediaRevisions\(client\)/);
  assert.match(page, /noindex, nofollow/);
  assert.match(page, /script-src 'self'/);
  assert.match(page, /data-media-revision/);
});

test('revision picker query includes property, article, and FAQ revisions without adding public detail routes', async () => {
  const calls = [];
  const records = ['property', 'article', 'faq'].map((kind, index) => ({
    id: `revision-${index}`, content_items: { kind },
  }));
  const query = {
    select(columns) { calls.push(['select', columns]); return this; },
    in(column, values) { calls.push(['in', column, values]); return this; },
    order(column, options) { calls.push(['order', column, options]); return this; },
    limit(count) { calls.push(['limit', count]); return Promise.resolve({ data: records, error: null }); },
  };
  const result = await listMediaRevisions({ from: (table) => {
    calls.push(['from', table]);
    return query;
  } });
  assert.deepEqual(result.map((row) => row.content_kind), ['property', 'article', 'faq']);
  assert.deepEqual(calls.find(([name]) => name === 'in'), [
    'in', 'content_items.kind', ['property', 'article', 'faq'],
  ]);
  assert.match(page, /property, article, or FAQ/);
  assert.doesNotMatch(page, /href="\/(?:blog|articles|faq)\//);
});

test('media dashboard provides revision-local upload, alt text and list controls', () => {
  assert.match(page, /data-media-upload/);
  assert.match(page, /name="revision"/);
  assert.match(page, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(page, /name="alt_text"/);
  assert.match(page, /data-media-list/);
  assert.match(script, /POST', body: data/);
  assert.match(script, /\/api\/admin\/media\?revision=/);
  assert.match(script, /Save alt text/);
  assert.match(script, /Move up/);
  assert.match(script, /Move down/);
  assert.match(script, /Set as cover/);
  assert.match(script, /DELETE/);
  assert.doesNotMatch(script, /innerHTML/);
});

test('reordering and metadata writes use the secured media API and serialized position updates', () => {
  assert.match(script, /\/api\/admin\/media\/\$\{encodeURIComponent\(row\.id\)\}/);
  assert.match(script, /credentials: 'same-origin'/);
  assert.match(script, /JSON\.stringify\(next\)/);
  assert.match(migration, /position = position - 1/);
  assert.match(migration, /position = position \+ 1/);
  assert.match(migration, /perform 1 from public\.content_items where id = target_item for update/);
});
