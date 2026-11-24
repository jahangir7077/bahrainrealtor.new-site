import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInternalLinks } from '../src/utils/seo/internal-links.ts';
import { eligibleSitemapRoutes, robotsIndexingDirective } from '../src/utils/seo/index-eligibility.ts';
import {
  articleSchema,
  breadcrumbSchema,
  organizationSchema,
  personSchema,
  propertySchema,
  realEstateAgentSchema,
  safeJsonLd,
} from '../src/utils/seo/structured-data.ts';

const publication = (language = 'en', overrides = {}) => ({
  status: 'published',
  revisionId: `${language}-v1`,
  publicationApprovedRevisionId: `${language}-v1`,
  publishedRevisionId: `${language}-v1`,
  ...(language === 'ar' ? { humanReviewedRevisionId: `${language}-v1` } : {}),
  routePath: language === 'ar' ? '/ar/example/' : '/example/',
  canonicalPath: language === 'ar' ? '/ar/example/' : '/example/',
  routeExists: true,
  indexable: true,
  redirected: false,
  ...overrides,
});

test('internal-link validation accepts safe local paths only', () => {
  assert.deepEqual(validateInternalLinks([
    '/safe/',
    '/ar/safe/',
    'https://outside.example/',
    '//outside.example/',
    '/%2e%2e/private/',
    '/safe/?q=1',
  ]), {
    valid: ['/safe/', '/ar/safe/'],
    invalid: ['https://outside.example/', '//outside.example/', '/%2e%2e/private/', '/safe/?q=1'],
  });
});

test('sitemap and robots eligibility stay disabled by default and exclude unreviewed content', () => {
  const english = publication();
  const arabic = publication('ar');
  const unreviewedArabic = publication('ar', { humanReviewedRevisionId: undefined });
  const routes = [
    { language: 'en', path: '/example/', publication: english },
    { language: 'ar', path: '/ar/example/', publication: arabic },
    { language: 'ar', path: '/ar/unreviewed/', publication: unreviewedArabic },
  ];

  assert.deepEqual(eligibleSitemapRoutes(routes), routes.slice(0, 2));
  assert.equal(robotsIndexingDirective(english, 'en'), 'noindex, nofollow');
  assert.equal(robotsIndexingDirective(english, 'en', true), 'index, follow');
  assert.equal(robotsIndexingDirective(unreviewedArabic, 'ar', true), 'noindex, nofollow');
});

test('structured-data builders require safe paths and eligible, factual inputs', () => {
  assert.deepEqual(organizationSchema('Bahrain Realtor', '/'), {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Bahrain Realtor',
    url: 'https://bahrainrealtor.com/',
  });
  assert.equal(organizationSchema('Bahrain Realtor', '//outside.example/'), null);
  assert.equal(personSchema('Advisor', '/', 'https://outside.example/image.jpg'), null);
  assert.deepEqual(realEstateAgentSchema('Advisor', '/'), {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: 'Advisor',
    url: 'https://bahrainrealtor.com/',
  });
  assert.deepEqual(breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Property', path: '/properties/sample-id/' },
  ]), {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bahrainrealtor.com/' },
      { '@type': 'ListItem', position: 2, name: 'Property', item: 'https://bahrainrealtor.com/properties/sample-id/' },
    ],
  });
  assert.equal(breadcrumbSchema([{ name: 'Unsafe', path: 'https://outside.example/' }]), null);

  const articlePublication = publication('en', {
    routePath: '/insights/example/',
    canonicalPath: '/insights/example/',
  });
  assert.ok(articleSchema({
    title: 'Reviewed article',
    path: '/insights/example/',
    authorName: 'Verified author',
    publishedAt: '2026-01-01',
    publication: articlePublication,
    language: 'en',
  }));
  assert.equal(articleSchema({
    title: 'Draft',
    path: '/insights/example/',
    authorName: 'Verified author',
    publishedAt: 'not-a-date',
    publication: articlePublication,
    language: 'en',
  }), null);

  const propertyPublication = publication('en', {
    routePath: '/properties/sample-home-id/',
    canonicalPath: '/properties/sample-home-id/',
  });
  const property = {
    id: 'internal-id',
    immutableReference: 'sample-home-id',
    slug: 'sample-home',
    transaction: 'sale',
    availability: 'available',
    priceBhd: '123456.789',
    locationName: 'Verified location',
    content: { en: { title: 'Verified home', description: 'Verified property description.', areaName: 'Verified area', propertyType: 'Apartment' } },
    images: [],
    publication: { en: propertyPublication },
  };
  assert.equal(propertySchema(property, 'en')?.offers.price, '123456.789');
  assert.equal(propertySchema(property, 'en')?.url, 'https://bahrainrealtor.com/properties/sample-home-id/');
  assert.equal(propertySchema({ ...property, priceBhd: '12.1234' }, 'en'), null);
  assert.equal(propertySchema({ ...property, publication: { en: publication('en', { indexable: false }) } }, 'en'), null);
  assert.match(safeJsonLd({ content: '</script><script>alert(1)</script>' }), /\\u003c\/script>/);
});
