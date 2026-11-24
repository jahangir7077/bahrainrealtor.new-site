import type { Language } from '../../i18n/config.ts';
import { getPublicationEligibility, type PublicationVersion } from '../../i18n/publication.ts';
import { canonicalUrlFor } from './canonical.ts';

export interface HreflangPage {
  language: Language;
  publication: PublicationVersion;
}

export interface HreflangLink {
  hreflang: 'en-BH' | 'ar-BH' | 'x-default';
  href: string;
}

const LANGUAGE_TAGS = { en: 'en-BH', ar: 'ar-BH' } as const;

export function hreflangForEquivalentPages(pages: readonly HreflangPage[]): HreflangLink[] {
  const eligible = new Map<Language, string>();
  const seen = new Set<Language>();

  for (const page of pages) {
    if (seen.has(page.language)) return [];
    seen.add(page.language);
    const { publication } = page;
    const eligibility = getPublicationEligibility(publication, page.language);
    if (!eligibility.languageEquivalentEligible) continue;
    if (!publication.canonicalPath || publication.canonicalPath !== publication.routePath) continue;
    const href = canonicalUrlFor(page.language, publication.canonicalPath);
    if (!href) continue;
    eligible.set(page.language, href);
  }

  const links: HreflangLink[] = [];
  for (const [language, href] of eligible) {
    links.push({ hreflang: LANGUAGE_TAGS[language], href });
  }
  const english = eligible.get('en');
  if (english) links.push({ hreflang: 'x-default', href: english });
  return links;
}
