import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  const { pathname } = _context.url;
  const seoEndpoint = ['/sitemap.xml', '/robots.txt'].includes(pathname);
  const approvedPropertyPage =
    process.env.SEO_INDEXING_ENABLED === 'true' &&
    response.status === 200 &&
    /^\/(?:ar\/)?properties\/[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/$/i.test(pathname);
  if (!seoEndpoint) response.headers.set('Cache-Control', 'no-store, max-age=0');
  if (approvedPropertyPage) {
    response.headers.delete('X-Robots-Tag');
  } else if (!seoEndpoint && !response.headers.has('X-Robots-Tag')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
});
