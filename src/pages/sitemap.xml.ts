import { listPublishedPropertyPaths } from '../server/properties/repository.ts';
import { listPublishedEditorialPaths } from '../server/editorial/repository.ts';
import { sitemapXml } from '../utils/seo/sitemap.ts';

export const prerender = false;

export async function GET() {
  const enabled = process.env.SEO_INDEXING_ENABLED === 'true';
  try {
    const paths = enabled
      ? [
          ...await listPublishedPropertyPaths(),
          ...await listPublishedEditorialPaths(),
        ]
      : [];
    return new Response(sitemapXml(paths), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': enabled ? 'public, max-age=300, stale-while-revalidate=300' : 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Sitemap temporarily unavailable.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
}
