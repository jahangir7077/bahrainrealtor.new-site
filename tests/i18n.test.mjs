import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LANGUAGE,
  FORMAT_CONFIG,
  localeConfig,
  supportedLanguages,
} from '../src/i18n/config.ts';
import {
  ARABIC_TRANSLATION_REVIEW_STATUS,
  translate,
  validateTranslationCompleteness,
} from '../src/i18n/translate.ts';
import {
  detectLanguage,
  equivalentRouteCandidates,
  localizedPath,
  normalizeInternalPath,
  resolveLanguageEquivalent,
} from '../src/i18n/routes.ts';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPropertyNumber,
  pluralCategory,
} from '../src/i18n/formatting.ts';
import { getPublicationEligibility } from '../src/i18n/publication.ts';

const published = (language, overrides = {}) => ({
  status: 'published',
  revisionId: `${language}-r1`,
  publicationApprovedRevisionId: `${language}-r1`,
  publishedRevisionId: `${language}-r1`,
  ...(language === 'ar' ? { humanReviewedRevisionId: `${language}-r1` } : {}),
  routePath: language === 'ar' ? '/ar/example/' : '/example/',
  canonicalPath: language === 'ar' ? '/ar/example/' : '/example/',
  routeExists: true,
  indexable: true,
  redirected: false,
  ...overrides,
});

test('locale configuration is centralized and defines approved Bahrain defaults', () => {
  assert.deepEqual(supportedLanguages, ['en', 'ar']);
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(localeConfig.en.regionalLocale, 'en-BH');
  assert.equal(localeConfig.ar.regionalLocale, 'ar-BH');
  assert.equal(localeConfig.en.direction, 'ltr');
  assert.equal(localeConfig.ar.direction, 'rtl');
  assert.equal(localeConfig.en.urlPrefix, '');
  assert.equal(localeConfig.ar.urlPrefix, '/ar/');
  assert.equal(localeConfig.ar.numberingSystem, 'latn');
  assert.deepEqual(FORMAT_CONFIG, {
    currency: 'BHD',
    timeZone: 'Asia/Bahrain',
    calendar: 'gregory',
  });
});

test('English and Arabic dictionaries have matching keys and explicit missing-key behavior', () => {
  assert.deepEqual(validateTranslationCompleteness(), { valid: true, missing: [], extra: [] });
  assert.equal(translate('en', 'development.placeholder'), 'Development placeholder.');
  assert.equal(translate('ar', 'development.placeholder'), 'صفحة تطويرية مؤقتة.');
  assert.equal(translate('ar', 'missing.key'), '⟦missing translation: missing.key⟧');
  assert.equal(ARABIC_TRANSLATION_REVIEW_STATUS, 'proposed-needs-owner-review');
});

test('translation interpolation treats dynamic content as text and preserves replacement characters', () => {
  assert.equal(translate('en', 'translation.greeting', { name: '$& <img>' }), 'Hello, $& <img>.');
  assert.equal(translate('ar', 'translation.greeting', { name: 'Ali' }), 'مرحباً، Ali.');
  assert.equal(translate('en', 'vocabulary.propertyCount'), '⟦missing plural count: vocabulary.propertyCount⟧');
});

test('native plural rules select English and Arabic grammatical categories', () => {
  assert.equal(pluralCategory(1, 'en'), 'one');
  assert.equal(pluralCategory(2, 'en'), 'other');
  assert.deepEqual([0, 1, 2, 3, 11, 100].map((count) => pluralCategory(count, 'ar')), [
    'zero',
    'one',
    'two',
    'few',
    'many',
    'other',
  ]);
  for (const [count, phrase] of [[0, '0 عقار'], [1, '1 عقار'], [2, '2 عقاران'], [3, '3 عقارات'], [11, '11 عقاراً'], [100, '100 عقار']]) {
    assert.ok(translate('ar', 'vocabulary.propertyCount', { count }).includes(phrase));
  }
});

test('localized route helpers generate candidates without claiming page existence', () => {
  assert.equal(detectLanguage('/'), 'en');
  assert.equal(detectLanguage('/ar/'), 'ar');
  assert.equal(detectLanguage('/fr/example/'), null);
  assert.equal(localizedPath('/', 'ar'), '/ar/');
  assert.equal(localizedPath('/areas/amwaj-islands/', 'ar'), '/ar/areas/amwaj-islands/');
  assert.equal(localizedPath('/ar/properties/example-id/', 'en'), '/properties/example-id/');
  assert.equal(localizedPath('/ar/ar/example/', 'ar'), null);
  assert.deepEqual(equivalentRouteCandidates('/areas/amwaj-islands/'), {
    en: '/areas/amwaj-islands/',
    ar: '/ar/areas/amwaj-islands/',
  });
});

test('internal paths reject external, malformed, encoded and traversal input', () => {
  for (const path of [
    'https://example.com/',
    '//example.com/path',
    '/%2e%2e/secret/',
    '/%252e%252e/secret/',
    '/../secret/',
    '/./secret/',
    '/a//b/',
    '/a\\b/',
    '/safe/?next=https://example.com',
    '/safe/#fragment',
    '/fr/safe/',
  ]) {
    if (path === '/fr/safe/') {
      assert.equal(normalizeInternalPath(path), '/fr/safe/');
      assert.equal(detectLanguage(path), null);
    } else {
      assert.equal(normalizeInternalPath(path), null, path);
    }
    assert.equal(localizedPath(path, 'ar'), null, path);
  }
  assert.equal(normalizeInternalPath('/areas/amwaj-islands'), '/areas/amwaj-islands/');
});

test('language equivalent resolution requires an existing eligible target and separates dev placeholders', () => {
  const englishOnly = {
    id: 'one-language',
    languages: { en: { path: '/example/', routeExists: true, publication: published('en') } },
  };
  assert.deepEqual(
    resolveLanguageEquivalent('/example/', 'ar', englishOnly),
    { available: false, reason: 'translation-unavailable' },
  );
  assert.equal(
    resolveLanguageEquivalent('/example/', 'ar', englishOnly, 'production').available,
    false,
  );

  const bilingual = {
    id: 'bilingual',
    languages: {
      en: { path: '/example/', routeExists: true, publication: published('en') },
      ar: { path: '/ar/example/', routeExists: true, publication: published('ar') },
    },
  };
  assert.deepEqual(resolveLanguageEquivalent('/example/', 'ar', bilingual), {
    available: true,
    href: '/ar/example/',
    language: 'ar',
  });
  bilingual.languages.ar.publication.humanReviewedRevisionId = 'older-revision';
  assert.equal(resolveLanguageEquivalent('/example/', 'ar', bilingual).available, false);

  const devPlaceholders = {
    id: 'dev',
    languages: {
      en: { path: '/', routeExists: true, developmentOnly: true },
      ar: { path: '/ar/', routeExists: true, developmentOnly: true },
    },
  };
  assert.equal(resolveLanguageEquivalent('/', 'ar', devPlaceholders).available, false);
  assert.deepEqual(resolveLanguageEquivalent('/', 'ar', devPlaceholders, 'development'), {
    available: true,
    href: '/ar/',
    language: 'ar',
  });
});

test('BHD formatting accepts exact decimal strings and preserves three-place precision', () => {
  assert.match(formatCurrency('125000', 'en'), /BHD.*125,000/);
  assert.match(formatCurrency('125000', 'ar'), /125,000.*د\.ب/);
  assert.match(formatCurrency('125000.125', 'en'), /125,000\.125/);
  assert.match(formatCurrency('125000.125', 'ar'), /125,000\.125/);
  assert.match(formatCurrency('125000.120', 'en'), /125,000\.12$/);
  assert.equal(formatCurrency('125000.1234', 'en'), null);
  assert.equal(formatCurrency(125000, 'en'), null);
  assert.equal(formatNumber(125000, 'ar'), '125,000');
  assert.equal(formatPropertyNumber(3, 'ar', 0), '3');
  assert.equal(formatCurrency(125000n, 'en')?.includes('125,000'), true);
});

test('date formatting uses Gregorian Bahrain time and rejects invalid values', () => {
  assert.match(formatDate('2024-01-01', 'en') ?? '', /January 1, 2024/);
  assert.match(formatDate('2024-01-01', 'ar') ?? '', /1.*يناير.*2024/);
  assert.match(formatDate('2024-01-01T22:30:00Z', 'en') ?? '', /January 2, 2024/);
  assert.equal(formatDate('2023-02-29', 'en'), null);
  assert.equal(formatDate('not-a-date', 'en'), null);
});

test('publication eligibility keeps approval independent per language and revision', () => {
  assert.equal(getPublicationEligibility(published('en'), 'en').indexingEligible, true);
  assert.equal(getPublicationEligibility(published('ar'), 'ar').indexingEligible, true);
  assert.equal(
    getPublicationEligibility(published('ar', { humanReviewedRevisionId: undefined }), 'ar').contentEligible,
    false,
  );
  assert.equal(
    getPublicationEligibility(published('en', { status: 'draft' }), 'en').routeAvailable,
    false,
  );
  assert.equal(
    getPublicationEligibility(published('en', { status: 'preview' }), 'en').routeAvailable,
    false,
  );
  assert.equal(
    getPublicationEligibility(published('ar', { revisionId: 'ar-r2' }), 'ar').contentEligible,
    false,
  );
  assert.equal(
    getPublicationEligibility(published('en', { status: 'archived' }), 'en').indexingEligible,
    false,
  );
  assert.equal(
    getPublicationEligibility(published('en', { redirected: true }), 'en').languageEquivalentEligible,
    false,
  );
});
