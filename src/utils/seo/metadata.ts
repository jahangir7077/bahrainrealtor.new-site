import type { Language } from '../../i18n/config.ts';
import { localeConfig } from '../../i18n/config.ts';
import { detectLanguage, normalizeInternalPath } from '../../i18n/routes.ts';
import type { HreflangLink } from './hreflang.ts';
import { canonicalUrlFor } from './canonical.ts';
import { site } from '../../config/site.ts';

export interface LocalizedMetadataInput {
  title: string;
  description: string;
  language: Language;
  pathname: string;
  indexingEligible: boolean;
  enableCanonical?: boolean;
  alternates?: readonly HreflangLink[];
}

export interface LocalizedMetadata {
  title: string;
  description: string;
  language: Language;
  openGraphLocale: 'en_BH' | 'ar_BH';
  canonicalUrl?: string;
  robots: 'index, follow' | 'noindex, nofollow';
  alternates: readonly HreflangLink[];
}

function safeAlternates(alternates: readonly HreflangLink[]): HreflangLink[] {
  const productionOrigin = new URL(site.productionUrl).origin;
  return alternates.filter((alternate) => {
    try {
      const url = new URL(alternate.href);
      const path = normalizeInternalPath(url.pathname);
      const language = alternate.hreflang === 'en-BH' || alternate.hreflang === 'x-default'
        ? 'en'
        : 'ar';
      return url.origin === productionOrigin &&
        url.protocol === 'https:' &&
        !url.search &&
        !url.hash &&
        path === url.pathname &&
        detectLanguage(path) === language;
    } catch {
      return false;
    }
  });
}

export function localizedMetadata(input: LocalizedMetadataInput): LocalizedMetadata | null {
  const pathname = normalizeInternalPath(input.pathname);
  if (!pathname || !input.title.trim() || !input.description.trim()) return null;
  const canonicalUrl =
    input.enableCanonical &&
    input.indexingEligible &&
    (detectLanguage(pathname) === input.language || (input.language === 'ar' && detectLanguage(pathname) === 'en'))
      ? canonicalUrlFor(input.language, pathname) ?? undefined
      : undefined;
  const indexingEligible =
    input.indexingEligible &&
    (detectLanguage(pathname) === input.language || (input.language === 'ar' && detectLanguage(pathname) === 'en'));

  return {
    title: input.title,
    description: input.description,
    language: input.language,
    openGraphLocale: localeConfig[input.language].regionalLocale.replace('-', '_') as 'en_BH' | 'ar_BH',
    ...(canonicalUrl ? { canonicalUrl } : {}),
    robots: indexingEligible ? 'index, follow' : 'noindex, nofollow',
    alternates: indexingEligible ? safeAlternates(input.alternates ?? []) : [],
  };
}
