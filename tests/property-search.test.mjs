import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFilters, propertyFromRow } from '../src/server/properties/repository.ts';
import { contentMetadata } from '../src/utils/seo/content-metadata.ts';

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

test('public property metadata uses approved CMS SEO fields with safe content fallbacks', () => {
  const row = {
    id: '11111111-1111-4111-8111-111111111111',
    kind: 'property',
    slug: 'manama-apartment',
    locale: 'en',
    revision_id: '22222222-2222-4222-8222-222222222222',
    published_at: '2026-11-25T00:00:00Z',
    title: 'Manama apartment',
    body: 'A clear property description.',
    summary: 'A concise summary.',
    seo_title: 'Apartment for sale in Manama',
    seo_description: 'Human-approved description for the listing.',
    area_name: 'Manama',
    property_type: 'Apartment',
    transaction_type: 'sale',
    availability: 'available',
    price_bhd: '100000',
    bedrooms: 2,
    bathrooms: 2,
    size_square_meters: 120,
    location_name: 'Manama',
  };
  const property = propertyFromRow(row, 'en');
  assert.equal(property.seoTitle, row.seo_title);
  assert.equal(property.seoDescription, row.seo_description);
  assert.deepEqual(contentMetadata({
    title: property.title,
    description: property.summary ?? property.body,
    seoTitle: property.seoTitle,
    seoDescription: property.seoDescription,
  }), {
    title: row.seo_title,
    description: row.seo_description,
  });
  assert.deepEqual(contentMetadata({ title: '  عنوان العقار  ', description: ' وصف   واضح ' }), {
    title: 'عنوان العقار',
    description: 'وصف واضح',
  });
  assert.equal(contentMetadata({ title: 't'.repeat(250), description: 'd'.repeat(600) }).title.length, 200);
  assert.equal(contentMetadata({ title: 'Title', description: 'd'.repeat(600) }).description.length, 500);
  assert.throws(() => propertyFromRow({ ...row, seo_title: 'x'.repeat(201) }, 'en'), /Invalid public property/);
});
