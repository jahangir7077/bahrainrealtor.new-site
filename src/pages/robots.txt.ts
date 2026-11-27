import { robotsTxt } from '../utils/seo/sitemap.ts';

export const prerender = false;

export function GET() {
  const enabled = process.env.SEO_INDEXING_ENABLED === 'true';
  return new Response(robotsTxt(enabled), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
