import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrlFor } from '../src/utils/seo/canonical.ts';
import { hreflangForEquivalentPages } from '../src/utils/seo/hreflang.ts';
import { localizedMetadata } from '../src/utils/seo/metadata.ts';

const version = (language, overrides = {}) => ({
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

test('canonical URLs use the approved absolute origin and localized self paths', () => {
  assert.equal(canonicalUrlFor('en', '/example/'), 'https://bahrainrealtor.com/example/');
  assert.equal(canonicalUrlFor('ar', '/example/'), 'https://bahrainrealtor.com/ar/example/');
  assert.equal(canonicalUrlFor('ar', '/ar/example/'), 'https://bahrainrealtor.com/ar/example/');
  for (const path of ['https://evil.example/', '//evil.example/', '/%2e%2e/x/', '/path/?q=1', '/path/#fragment', '/fr/path/', '/ar/example/']) {
    assert.equal(canonicalUrlFor('en', path), null);
  }
});

test('hreflang alternates are reciprocal, self-referencing and eligibility-gated', () => {
  const pages = [
    { language: 'en', publication: version('en') },
    { language: 'ar', publication: version('ar') },
  ];
  assert.deepEqual(hreflangForEquivalentPages(pages), [
    { hreflang: 'en-BH', href: 'https://bahrainrealtor.com/example/' },
    { hreflang: 'ar-BH', href: 'https://bahrainrealtor.com/ar/example/' },
    { hreflang: 'x-default', href: 'https://bahrainrealtor.com/example/' },
  ]);
  assert.deepEqual(
    hreflangForEquivalentPages([{ language: 'en', publication: version('en') }]),
    [
      { hreflang: 'en-BH', href: 'https://bahrainrealtor.com/example/' },
      { hreflang: 'x-default', href: 'https://bahrainrealtor.com/example/' },
    ],
  );
  assert.deepEqual(
    hreflangForEquivalentPages([{ language: 'ar', publication: version('ar', { humanReviewedRevisionId: undefined }) }]),
    [],
  );
  assert.deepEqual(
    hreflangForEquivalentPages([{ language: 'en', publication: version('en', { routeExists: false }) }]),
    [],
  );
  assert.deepEqual(
    hreflangForEquivalentPages([{ language: 'en', publication: version('en', { redirected: true }) }]),
    [],
  );
  assert.deepEqual(
    hreflangForEquivalentPages([{ language: 'en', publication: version('en', { indexable: false }) }]),
    [],
  );
  assert.deepEqual(
    hreflangForEquivalentPages([
      { language: 'en', publication: version('en', { routePath: '/ar/example/', canonicalPath: '/ar/example/' }) },
    ]),
    [],
  );
  assert.deepEqual(
    hreflangForEquivalentPages([{ language: 'en', publication: version('en', { canonicalPath: '/other/' }) }]),
    [],
  );
});

test('localized metadata separates indexing eligibility from optional canonical activation', () => {
  const placeholder = localizedMetadata({
    title: 'Development',
    description: 'Placeholder',
    language: 'en',
    pathname: '/',
    indexingEligible: false,
    enableCanonical: true,
    alternates: [{ hreflang: 'en-BH', href: 'https://bahrainrealtor.com/' }],
  });
  assert.equal(placeholder?.openGraphLocale, 'en_BH');
  assert.equal(placeholder?.robots, 'noindex, nofollow');
  assert.equal(placeholder?.canonicalUrl, undefined);
  assert.deepEqual(placeholder?.alternates, []);

  const arabic = localizedMetadata({
    title: 'العنوان',
    description: 'وصف',
    language: 'ar',
    pathname: '/ar/example/',
    indexingEligible: true,
    enableCanonical: true,
    alternates: [
      { hreflang: 'en-BH', href: 'https://bahrainrealtor.com/example/' },
      { hreflang: 'ar-BH', href: 'https://evil.example/ar/example/' },
    ],
  });
  assert.equal(arabic?.openGraphLocale, 'ar_BH');
  assert.equal(arabic?.canonicalUrl, 'https://bahrainrealtor.com/ar/example/');
  assert.equal(arabic?.robots, 'index, follow');
  assert.deepEqual(arabic?.alternates, [
    { hreflang: 'en-BH', href: 'https://bahrainrealtor.com/example/' },
  ]);
  const mismatchedLanguagePath = localizedMetadata({
    title: 'Wrong locale path',
    description: 'Metadata must not index another language route.',
    language: 'en',
    pathname: '/ar/example/',
    indexingEligible: true,
    enableCanonical: true,
  });
  assert.equal(mismatchedLanguagePath?.robots, 'noindex, nofollow');
  assert.equal(mismatchedLanguagePath?.canonicalUrl, undefined);
  assert.equal(localizedMetadata({
    title: '   ',
    description: 'Description',
    language: 'en',
    pathname: '/',
    indexingEligible: false,
  }), null);
});
