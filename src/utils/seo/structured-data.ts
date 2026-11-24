import type { Language } from '../../i18n/config.ts';
import { getPublicationEligibility, type PublicationVersion } from '../../i18n/publication.ts';
import { normalizeInternalPath } from '../../i18n/routes.ts';
import { site } from '../../config/site.ts';
import type { PropertyRecord } from '../../types/content.ts';

export interface BreadcrumbData {
  name: string;
  path: string;
}

function productionUrl(path: unknown): string | null {
  const safePath = normalizeInternalPath(path);
  return safePath ? new URL(safePath, site.productionUrl).href : null;
}

export function organizationSchema(name: string, path: string) {
  const url = productionUrl(path);
  if (!name.trim() || !url) return null;
  return { '@context': 'https://schema.org', '@type': 'Organization', name: name.trim(), url };
}

export function personSchema(name: string, path: string, imagePath?: string) {
  const url = productionUrl(path);
  const image = imagePath ? productionUrl(imagePath) : null;
  if (!name.trim() || !url || (imagePath && !image)) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: name.trim(),
    url,
    ...(image ? { image } : {}),
  };
}

export function realEstateAgentSchema(name: string, path: string) {
  const url = productionUrl(path);
  if (!name.trim() || !url) return null;
  return { '@context': 'https://schema.org', '@type': 'RealEstateAgent', name: name.trim(), url };
}

export function breadcrumbSchema(items: readonly BreadcrumbData[]) {
  if (!items.length) return null;
  const itemListElement = items.map((item, index) => {
    const itemUrl = productionUrl(item.path);
    return item.name.trim() && itemUrl
      ? { '@type': 'ListItem', position: index + 1, name: item.name.trim(), item: itemUrl }
      : null;
  });
  if (itemListElement.some((item) => item === null)) return null;
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement };
}

export function articleSchema(input: {
  title: string;
  path: string;
  authorName: string;
  publishedAt: string;
  updatedAt?: string;
  publication: PublicationVersion;
  language: Language;
}) {
  const url = productionUrl(input.path);
  if (
    !url ||
    !input.title.trim() ||
    !input.authorName.trim() ||
    !Number.isFinite(Date.parse(input.publishedAt)) ||
    !getPublicationEligibility(input.publication, input.language).indexingEligible ||
    input.publication.canonicalPath !== input.path ||
    input.publication.routePath !== input.path
  ) {
    return null;
  }
  const modified = input.updatedAt && Number.isFinite(Date.parse(input.updatedAt)) ? input.updatedAt : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title.trim(),
    author: { '@type': 'Person', name: input.authorName.trim() },
    datePublished: input.publishedAt,
    ...(modified ? { dateModified: modified } : {}),
    mainEntityOfPage: url,
  };
}

export function propertySchema(property: PropertyRecord, language: Language) {
  const publication = property.publication[language];
  const content = property.content[language];
  const url = publication ? productionUrl(publication.canonicalPath) : null;
  const price = property.priceBhd;
  if (
    !publication ||
    !content ||
    !url ||
    !getPublicationEligibility(publication, language).indexingEligible ||
    !price ||
    !/^\d+(?:\.\d{1,3})?$/.test(price) ||
    publication.canonicalPath !== publication.routePath
  ) {
    return null;
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: content.title,
    description: content.description,
    url,
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: 'BHD',
      availability: property.availability === 'available'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };
}

export function safeJsonLd(value: unknown): string {
  return (JSON.stringify(value) ?? 'null').replace(/</g, '\\u003c');
}
