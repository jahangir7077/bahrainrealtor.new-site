import { defineMiddleware } from 'astro:middleware';
import { isSiteContentRoute } from './server/site-content/routes.ts';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  const { pathname } = _context.url;
  const seoEndpoint = ['/sitemap.xml', '/robots.txt'].includes(pathname);
  const approvedPropertyPage =
    process.env.SEO_INDEXING_ENABLED === 'true' &&
    response.status === 200 &&
    /^\/(?:ar\/)?properties\/[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/$/i.test(pathname);
  const approvedGuidePage =
    process.env.SEO_INDEXING_ENABLED === 'true' &&
    response.status === 200 &&
    /^\/(?:ar\/)?guides\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/i.test(pathname);
  const approvedEditorialArchive =
    process.env.SEO_INDEXING_ENABLED === 'true' &&
    response.status === 200 &&
    /^\/(?:ar\/)?blog\/(?:articles|faqs)?\/$/i.test(pathname);
  const siteContentPath = pathname.replace(/^\/ar(?=\/)/, '');
  const approvedSiteContentPage =
    process.env.SEO_INDEXING_ENABLED === 'true' &&
    response.status === 200 &&
    isSiteContentRoute(siteContentPath);
  if (!seoEndpoint) response.headers.set('Cache-Control', 'no-store, max-age=0');
  if (approvedPropertyPage || approvedGuidePage || approvedEditorialArchive || approvedSiteContentPage) {
    response.headers.delete('X-Robots-Tag');
  } else if (!seoEndpoint && !response.headers.has('X-Robots-Tag')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
});
