import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFilters } from '../src/server/properties/repository.ts';

test('property search accepts bounded localized text, exact decimal bounds and sort options', () => {
  assert.deepEqual(parseFilters(new URLSearchParams(
    'q=%D9%85%D9%86%D8%A7%D9%85%D8%A9&location=Manama&propertyType=Apartment&minimumPrice=100.125&maximumPrice=250000&sort=price_asc&page=2',
  )), {
    page: 2,
    query: 'منامة',
    location: 'Manama',
    propertyType: 'Apartment',
    minimumPrice: '100.125',
    maximumPrice: '250000',
    sort: 'price_asc',
  });
  assert.equal(parseFilters(new URLSearchParams('sort=bedrooms'))?.sort, 'bedrooms');
  assert.equal(parseFilters(new URLSearchParams('sort=price_desc'))?.sort, 'price_desc');
  assert.equal(parseFilters(new URLSearchParams('sort=newest'))?.sort, 'newest');
});

test('property search rejects malformed, ambiguous or unsafe criteria', () => {
  for (const search of [
    'page=0',
    'page=51',
    'page=1&page=2',
    'q=Manama%2Cprice_bhd.eq.0',
    'minimumPrice=-1',
    'minimumPrice=100.0001',
    'minimumPrice=200&maximumPrice=199',
    'sort=unsupported',
    'location=a&location=b',
    'propertyType=Apartment%26select%3D*',
  ]) assert.equal(parseFilters(new URLSearchParams(search)), null, search);
});
