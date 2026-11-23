# SEO, AEO, and technical strategy

## Status

These are proposed baseline requirements, pending project owner approval. The
confirmed project uses Astro, Netlify, GitHub, manually managed listings, and
English and Arabic for a premium Bahrain real estate site on bahrainrealtor.bh.
The existing site is bahrainrealtor.com. The
[architecture](website-architecture.md) records intended routes, while the
[keyword map](keyword-map.md) remains provisional until the original workbook
is available and analyzed. Neither document authorizes implementation.

## Search and content

- Create content for the approved audience and intent of each page. Use its
  mapped terms naturally in relevant headings, copy, title, and description;
  avoid keyword stuffing and duplicate pages targeting the same intent.
- Give each indexable page a descriptive, unique title and meta description,
  a clear primary heading, and useful internal links to relevant approved pages.
- Publish accurate, original, useful information. Verify claims, property
  details, availability, contact information, and business credentials with
  the owner; never fabricate them.

## English and Arabic

- Plan equivalent, useful content in English and Arabic with accurate,
  human-reviewed localization, including titles, descriptions, headings,
  navigation, and property information. Use appropriate language and text
  direction, including right-to-left presentation for Arabic.
- Agree the URL structure and page-to-page language mappings with the owner
  before implementation. Do not invent Arabic routes or assume every page has
  a translation.
- For available equivalent pages, use reciprocal hreflang annotations with
  appropriate language codes and absolute URLs. Each indexable language page
  should have a self-referencing canonical; do not canonicalize a translation
  to the other language. Include an x-default only if a suitable default page
  is agreed.
- Allow users and crawlers to access each language URL directly; avoid forced
  language redirects that prevent discovery. Analyze keyword intent separately
  for each language when the original workbook is available.

## Answer engine optimization (AEO)

- Answer the page's main question clearly and early, then provide useful
  supporting detail in descriptive sections. Use FAQs only where they help
  visitors and the answers can be verified.
- Make content understandable without relying solely on images or scripts.
  Use semantic headings and accessible text, and keep information current.
- Add structured data only when it accurately describes visible content and
  is appropriate for the page. Validate it against the relevant schema and
  search engine requirements; markup does not guarantee a rich result.

## Technical requirements

- Build the approved site with Astro and host it on Netlify, using GitHub for
  version control. Verify that generated HTML exposes essential content and
  metadata to crawlers, and that Netlify serves the agreed canonical URLs,
  status codes, and redirects.
- Make approved indexable pages discoverable through normal links, return
  appropriate HTTP status codes, and provide crawlable, renderable content.
  Set a consistent preferred canonical URL and avoid duplicate URL variants.
- Provide an XML sitemap containing canonical, indexable URLs and a robots.txt
  that does not block resources needed to render those pages. Use an
  appropriate noindex mechanism for pages that should not appear in search;
  do not rely on robots.txt alone for deindexing.
- Use HTTPS, responsive layouts, accessible semantic HTML, descriptive link
  text, and meaningful image alternatives. Optimize images and minimize
  unnecessary scripts and layout shifts.
- Measure Core Web Vitals with field data when available, aiming for Google's
  good thresholds at the 75th percentile: LCP at most 2.5 seconds, INP at
  most 200 milliseconds, and CLS at most 0.1.

## Manual property management

- Agree on the listing data, publishing workflow, ownership, and review process
  before implementation. Manage listings manually; do not assume a live feed
  or third-party integration.
- Verify details, media rights, translations, and availability before
  publication, and define how listings are updated or removed when no longer
  available. Agree how unavailable listing URLs are handled in the migration
  and redirect plan; do not invent replacement pages.

## Migration and redirects

1. Inventory the existing bahrainrealtor.com URLs using available crawl,
   sitemap, analytics, and search data; identify useful pages, language
   variants, current redirects, and incoming links where data is available.
2. With the owner, map each useful existing URL to an equivalent approved URL
   on bahrainrealtor.bh, preserving paths where appropriate. Record exceptions,
   pages without equivalents, and their agreed handling; do not send unrelated
   pages to the homepage by default.
3. Before launch, obtain approval for the mapping and arrange permanent
   server-side redirects from the old domain to the corresponding new URLs.
   Confirm control of both domains and their hosting, HTTPS certificates, and
   the duration of old-domain redirect support.
4. Test mappings, status codes, redirect chains, canonical URLs, hreflang,
   internal links, and the new XML sitemap. Update supported search tools and
   monitor crawl errors, indexing, traffic, and broken links after launch.

## Verification and changes

Before launch, check representative pages for metadata, canonical URLs,
indexability, structured data where used, mobile usability, accessibility,
performance, both languages, sitemap entries, and redirects. Record actual
measurement results rather than promising rankings or results. Obtain owner
approval before changing this strategy, and update the architecture and keyword
map when affected.
