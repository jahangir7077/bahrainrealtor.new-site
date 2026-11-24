import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFactsDraft, parseLifecycleTransition } from '../src/server/admin-properties/workflow.ts';

const item = '10000000-0000-4000-8000-000000000001';
const revision = '20000000-0000-4000-8000-000000000001';

test('lifecycle mutations require an explicit confirmation and property revision context', () => {
  assert.deepEqual(parseLifecycleTransition(new URLSearchParams(
    `action=unpublish&item=${item}&revision=${revision}&locale=ar&confirm=yes`,
  ), 'unpublish'), { item, revision, locale: 'ar' });
  assert.deepEqual(parseLifecycleTransition(new URLSearchParams(
    `action=archive&item=${item}&revision=${revision}&confirm=yes`,
  ), 'archive'), { item, revision });
  assert.deepEqual(parseLifecycleTransition(new URLSearchParams(
    `action=unarchive&item=${item}&revision=${revision}&confirm=yes`,
  ), 'unarchive'), { item, revision });
});

test('lifecycle mutations reject missing, duplicate, mismatched and extra fields', () => {
  for (const [payload, action] of [
    [`action=archive&item=${item}&revision=${revision}`, 'archive'],
    [`action=unpublish&item=${item}&revision=${revision}&locale=fr&confirm=yes`, 'unpublish'],
    [`action=archive&item=${item}&revision=${revision}&locale=en&confirm=yes`, 'archive'],
    [`action=archive&item=${item}&item=${item}&revision=${revision}&confirm=yes`, 'archive'],
    [`action=archive&item=${item}&revision=invalid&confirm=yes`, 'archive'],
    [`action=archive&item=${item}&revision=${revision}&confirm=yes&extra=1`, 'archive'],
  ]) assert.equal(parseLifecycleTransition(new URLSearchParams(payload), action), null);
});

test('new property fact revisions require complete valid facts and confirmation', () => {
  const form = new URLSearchParams({
    action: 'facts',
    revision,
    transaction_type: 'sale',
    availability: 'sold',
    price_bhd: '125000.500',
    bedrooms: '2',
    bathrooms: '1',
    size_square_meters: '100.25',
    location_name: 'Manama',
    confirm: 'yes',
  });
  assert.deepEqual(parseFactsDraft(form), {
    revision,
    transaction_type: 'sale',
    availability: 'sold',
    price_bhd: '125000.500',
    bedrooms: 2,
    bathrooms: 1,
    size_square_meters: '100.25',
    location_name: 'Manama',
  });
  form.set('confirm', 'no');
  assert.equal(parseFactsDraft(form), null);
  form.set('confirm', 'yes');
  form.set('availability', 'active');
  assert.equal(parseFactsDraft(form), null);
});
