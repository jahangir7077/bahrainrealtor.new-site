import { site } from '../../config/site.ts';
import { normalizeInternalPath } from '../../i18n/routes.ts';

export function sitemapXml(paths: readonly string[]): string {
  const origin = new URL(site.productionUrl).origin;
  const urls = [...new Set(paths)]
    .map((path) => normalizeInternalPath(path) === path ? path : null)
    .filter((path): path is string => path !== null)
    .map((path) => `  <url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`)
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
