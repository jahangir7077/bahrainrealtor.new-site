import type { Language } from '../../i18n/config.ts';
import { getPublicationEligibility, type PublicationVersion } from '../../i18n/publication.ts';
import { detectLanguage, normalizeInternalPath } from '../../i18n/routes.ts';

export interface PublishedRoute {
  language: Language;
  path: string;
  publication: PublicationVersion;
}

export function eligibleSitemapRoutes(routes: readonly PublishedRoute[]): PublishedRoute[] {
  return routes.filter(({ language, path, publication }) => {
    const eligibility = getPublicationEligibility(publication, language);
    const safePath = normalizeInternalPath(path);
    return Boolean(
      eligibility.indexingEligible &&
      safePath === path &&
      detectLanguage(path) === language &&
      publication.canonicalPath === path &&
      publication.routePath === path,
    );
  });
}

export function robotsIndexingDirective(
  publication: PublicationVersion | undefined,
  language: Language,
  productionIndexingEnabled = false,
): 'index, follow' | 'noindex, nofollow' {
  if (!productionIndexingEnabled || !publication) return 'noindex, nofollow';
  const safePath = normalizeInternalPath(publication.canonicalPath);
  return getPublicationEligibility(publication, language).indexingEligible &&
    safePath === publication.canonicalPath &&
    detectLanguage(publication.canonicalPath) === language
    ? 'index, follow'
    : 'noindex, nofollow';
}
