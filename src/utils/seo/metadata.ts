import type { Language } from '../../i18n/config.ts';
import { localeConfig } from '../../i18n/config.ts';
import { normalizeInternalPath } from '../../i18n/routes.ts';
import type { HreflangLink } from './hreflang.ts';
import { canonicalUrlFor } from './canonical.ts';

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
  robots: 'index,follow' | 'noindex,nofollow';
  alternates: readonly HreflangLink[];
}

export function localizedMetadata(input: LocalizedMetadataInput): LocalizedMetadata | null {
  const pathname = normalizeInternalPath(input.pathname);
  if (!pathname || !input.title.trim() || !input.description.trim()) return null;
  const canonicalUrl =
    input.enableCanonical && input.indexingEligible
      ? canonicalUrlFor(input.language, pathname) ?? undefined
      : undefined;

  return {
    title: input.title,
    description: input.description,
    language: input.language,
    openGraphLocale: localeConfig[input.language].regionalLocale.replace('-', '_') as 'en_BH' | 'ar_BH',
    ...(canonicalUrl ? { canonicalUrl } : {}),
    robots: input.indexingEligible ? 'index,follow' : 'noindex,nofollow',
    alternates: input.indexingEligible ? input.alternates ?? [] : [],
  };
}
