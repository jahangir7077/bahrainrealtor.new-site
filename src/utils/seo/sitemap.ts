import { site } from '../../config/site.ts';
import { normalizeInternalPath } from '../../i18n/routes.ts';

export interface SitemapEntry {
  path: string;
  lastModified?: string;
}

export function sitemapXml(entries: readonly (string | SitemapEntry)[]): string {
  const origin = new URL(site.productionUrl).origin;
  const urls = [...new Map(entries.map((entry) => {
    const path = typeof entry === 'string' ? entry : entry.path;
    return [path, typeof entry === 'string' ? undefined : entry.lastModified] as const;
  }))]
    .map(([path, lastModified]) => {
      if (normalizeInternalPath(path) !== path) return null;
      const location = `    <loc>${escapeXml(new URL(path, origin).href)}</loc>`;
      const date = lastModified && Number.isFinite(Date.parse(lastModified))
        ? `\n    <lastmod>${new Date(lastModified).toISOString()}</lastmod>`
        : '';
      return `  <url>\n${location}${date}\n  </url>`;
    })
    .filter((url): url is string => url !== null)
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
  ].filter(Boolean).join('\n');
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]!);
}

export function robotsTxt(sitemapEnabled: boolean): string {
  return [
    'User-agent: *',
    'Disallow: /admin/',
    'Disallow: /api/admin/',
    'Disallow: /api/internal/',
    'Disallow: /dev/',
    ...(sitemapEnabled ? [`Sitemap: ${new URL('/sitemap.xml', site.productionUrl).href}`] : []),
    '',
  ].join('\n');
}
