const mappedBuyRoutes = [
  '/buy-property/apartments-for-sale-in-amwaj-islands/',
  '/buy-property/apartments-for-sale-in-bahrain-bay/',
  '/buy-property/apartments-for-sale-in-bahrain-marina/',
  '/buy-property/apartments-for-sale-in-bahrain/',
  '/buy-property/apartments-for-sale-in-busaiteen/',
  '/buy-property/apartments-for-sale-in-dilmunia/',
  '/buy-property/apartments-for-sale-in-diyar-al-muharraq/',
  '/buy-property/apartments-for-sale-in-hidd/',
  '/buy-property/apartments-for-sale-in-juffair/',
  '/buy-property/apartments-for-sale-in-marassi/',
  '/buy-property/apartments-for-sale-in-reef-island/',
  '/buy-property/apartments-for-sale-in-riffa/',
  '/buy-property/apartments-for-sale-in-seef/',
  '/buy-property/apartments-for-sale-in-tala-island/',
  '/buy-property/buildings-for-sale-in-bahrain/',
  '/buy-property/commercial-property-for-sale-in-bahrain/',
  '/buy-property/freehold-property-for-sale-in-bahrain/',
  '/buy-property/houses-for-sale-in-amwaj-islands/',
  '/buy-property/houses-for-sale-in-bahrain/',
  '/buy-property/houses-for-sale-in-busaiteen/',
  '/buy-property/houses-for-sale-in-hidd/',
  '/buy-property/houses-for-sale-in-isa-town/',
  '/buy-property/houses-for-sale-in-muharraq/',
  '/buy-property/houses-for-sale-in-riffa/',
  '/buy-property/houses-for-sale-in-saar/',
  '/buy-property/investment-properties-for-sale-in-bahrain/',
  '/buy-property/land-for-sale-in-amwaj-islands/',
  '/buy-property/land-for-sale-in-bahrain/',
  '/buy-property/land-for-sale-in-diyar-al-muharraq/',
  '/buy-property/land-for-sale-in-hamala/',
  '/buy-property/property-for-sale-in-amwaj-islands/',
  '/buy-property/property-for-sale-in-bahrain-bay/',
  '/buy-property/property-for-sale-in-bahrain/',
  '/buy-property/property-for-sale-in-dilmunia/',
  '/buy-property/property-for-sale-in-diyar-al-muharraq/',
  '/buy-property/property-for-sale-in-hidd/',
  '/buy-property/property-for-sale-in-janabiya/',
  '/buy-property/property-for-sale-in-juffair/',
  '/buy-property/property-for-sale-in-marassi/',
  '/buy-property/property-for-sale-in-muharraq/',
  '/buy-property/property-for-sale-in-reef-island/',
  '/buy-property/property-for-sale-in-riffa/',
  '/buy-property/property-for-sale-in-seef/',
  '/buy-property/property-for-sale-in-tala-island/',
  '/buy-property/property-for-sale-in-tubli/',
  '/buy-property/specialty-residential-for-sale-in-amwaj-islands/',
  '/buy-property/specialty-residential-property-for-sale-in-bahrain/',
  '/buy-property/villas-for-sale-in-amwaj-islands/',
  '/buy-property/villas-for-sale-in-bahrain/',
  '/buy-property/villas-for-sale-in-diyar-al-muharraq/',
  '/buy-property/villas-for-sale-in-durrat-al-bahrain/',
  '/buy-property/villas-for-sale-in-hamala/',
  '/buy-property/villas-for-sale-in-hidd/',
  '/buy-property/villas-for-sale-in-janabiya/',
  '/buy-property/villas-for-sale-in-marassi/',
  '/buy-property/villas-for-sale-in-riffa/',
  '/buy-property/villas-for-sale-in-saar/',
  '/buy-property/villas-for-sale-in-tala-island/',
] as const;

const architectureRoutes = [
  '/buy-property/',
  '/buy-property/amwaj-island/',
  '/buy-property/tala-island/',
  '/buy-property/marassi-al-bahrain/',
  '/buy-property/diyar-al-muharraq/',
  '/buy-property/dilmunia-island/',
  '/buy-property/manama-capital/',
  '/rent-property/',
  '/rent-property/amwaj-island/',
  '/rent-property/tala-island/',
  '/rent-property/marassi-al-bahrain/',
  '/rent-property/diyar-al-muharraq/',
  '/rent-property/dilmunia-island/',
  '/rent-property/manama-capital/',
  '/projects/',
  '/bahrain-residency/',
  '/bahrain-residency/golden-visa-bahrain/',
  '/bahrain-residency/self-sponsorship-visa/',
] as const;

export const SITE_CONTENT_ROUTES = [...new Set([...mappedBuyRoutes, ...architectureRoutes])] as readonly string[];
const routeSet = new Set<string>(SITE_CONTENT_ROUTES);

export function isSiteContentRoute(path: string): boolean {
  return routeSet.has(path);
}

export function siteContentRouteKind(path: string): 'area' | 'project' | 'landing' | null {
  if (!isSiteContentRoute(path)) return null;
  if (path === '/projects/') return 'project';
  if (path.startsWith('/buy-property/') && path !== '/buy-property/' ||
      path.startsWith('/rent-property/') && path !== '/rent-property/') return 'area';
  return 'landing';
}

export function siteContentSlug(path: string): string | null {
  if (!isSiteContentRoute(path)) return null;
  return path.slice(1, -1).replaceAll('/', '-');
}

export function siteContentPath(slug: string): string | null {
  const path = `/${slug.replaceAll('-', '/')}/`;
  return isSiteContentRoute(path) ? path : null;
}
