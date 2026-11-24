import type { Language } from './config';

export type PublicationStatus = 'draft' | 'preview' | 'published' | 'unpublished' | 'archived';

export interface PublicationVersion {
  status: PublicationStatus;
  revisionId: string;
  publicationApprovedRevisionId?: string;
  publishedRevisionId?: string;
  humanReviewedRevisionId?: string;
  routePath: string;
  canonicalPath?: string;
  routeExists: boolean;
  indexable: boolean;
  redirected: boolean;
}

export interface PublicationEligibility {
  contentEligible: boolean;
  routeAvailable: boolean;
  indexingEligible: boolean;
  languageEquivalentEligible: boolean;
}

export function getPublicationEligibility(
  version: PublicationVersion,
  language: Language,
): PublicationEligibility {
  const approvedRevision =
    version.publicationApprovedRevisionId === version.revisionId &&
    version.publishedRevisionId === version.revisionId;
  const humanReviewed = language === 'en' || version.humanReviewedRevisionId === version.revisionId;
  const contentEligible = version.status === 'published' && approvedRevision && humanReviewed;
  const routeAvailable = contentEligible && version.routeExists;
  const indexingEligible =
    routeAvailable &&
    version.indexable &&
    !version.redirected &&
    Boolean(version.canonicalPath) &&
    version.canonicalPath === version.routePath;

  return {
    contentEligible,
    routeAvailable,
    indexingEligible,
    languageEquivalentEligible: indexingEligible,
  };
}
