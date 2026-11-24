# SEO, AEO, and technical strategy

## Status

These are the approved planning baseline for a rebuild of the existing site on
the only production domain, `https://bahrainrealtor.com/`. Do not use
`bahrainrealtor.bh` or `bahrainrealtot.com` as production domains. The project
uses Astro, Supabase, Hostinger Business Web Hosting, GitHub, manually managed
listings, and English and Arabic. The existing live site remains on Netlify
until an approved cutover. Supabase suitability, Astro/Hostinger runtime and
Node.js compatibility, deployment controls, vendor capabilities, security,
privacy requirements and costs remain subject to validation. The
[architecture](website-architecture.md) records intended
routes, while the [keyword map](keyword-map.md) remains provisional until the
original workbook is approved for final ownership. Phase 1B.2 is authorized
for visual design-system work only. This authorization does not change keyword
targeting, URL architecture, indexability, or authorize new public pages. Phase
1B.3 and later phases remain unauthorized.

## Search and content

- Create content for the approved audience and intent of each page. Use mapped
  terms naturally and avoid keyword stuffing or duplicate intent pages.
- Give each indexable page a unique title, meta description, primary heading
  and useful internal links.
- Publish accurate, original information. Verify claims, property details,
  availability, contact information and business credentials; never fabricate.
- Retain the ten planned article topics, prioritizing the first three and
  publishing the remainder only after research and cannibalization review.

## English and Arabic

- Provide useful, human-reviewed English and Arabic content, including
  metadata, navigation and property information, with RTL presentation for
  Arabic.
- Use `/ar/` equivalents with matching English slugs where content is reviewed
  and approved. Do not assume every page has a translation.
- For published equivalent pages, use reciprocal hreflang and absolute URLs.
  Each indexable language page uses a self-referencing canonical; do not
  canonicalize a translation to the other language.
- Allow direct access to each language URL and avoid forced language redirects.
  Analyze keyword intent separately for each language when evidence is
  available.

## Answer engine optimization (AEO)

- Answer the page's main question clearly and early, followed by useful detail.
- Use semantic headings and accessible text; keep information current.
- Add structured data only when it accurately describes visible content and
  validate it against relevant requirements.

## Technical requirements

- Plan the public site with Astro on Hostinger Business Web Hosting using
  GitHub. Verify the Node.js runtime, Astro adapter, SSR/hybrid deployment and
  manual approval-gated production deployment before implementation. Public
  properties, articles and FAQs must publish from Supabase without a code
  redeployment; static output alone cannot provide this behavior.
- Verify generated HTML, metadata, canonical URLs, status codes, caching,
  invalidation and redirects.
- Provide a dynamic XML sitemap containing canonical, indexable URLs and a
  robots.txt that does not block rendering resources. Require access control
  for private previews; use noindex for non-indexable content and do not rely
  on robots.txt alone for deindexing.
- Use HTTPS, responsive accessible HTML, meaningful image alternatives and
  optimized images. Validate Core Web Vitals with available field data.

## Manual property management

- Manage listings through a private single-administrator dashboard; do not
  assume a live feed or third-party integration.
- Use **Draft → Preview → Publish**, with independent English and Arabic
  publication approval. Arabic drafts may be translation-assisted but require
  human review before publication.
- Verify details, media rights, translations and availability before
  publication. Stable `/properties/` URLs use unique immutable IDs.
- Keep useful sold/rented property URLs with accurate status labels where
  appropriate, while removing them from active searches. Drafts and private
  previews must be inaccessible anonymously and absent from public sitemaps.

## Enquiries, resilience and revisions

Store website enquiries securely with property context, consent information,
anti-abuse controls and email notifications. Do not imply that WhatsApp or
call clicks are automatically stored as leads. Require database backups,
separate image backups, revision history and restore testing, subject to
verification of vendor capabilities, retention, restoration granularity and
cost.

## Migration and redirects

1. Inventory existing `bahrainrealtor.com` URLs using crawl, sitemap, analytics
   and search data where available. Identify useful pages, language variants,
   redirects and incoming links.
2. Map each useful URL to an equivalent approved URL on `bahrainrealtor.com`,
   preserving paths where appropriate. Record exceptions and pages without
   equivalents; do not send unrelated pages to the homepage by default.
3. Before launch, obtain approval for the mapping and configure permanent
   server-side 301 redirects only where a URL changed. This is a rebuild on
   the same domain, not a `.com`-to-`.bh` migration. Final mappings remain
   pending the live-site and search-data audit.
4. Test mappings, status codes, redirect chains, canonicals, hreflang,
   internal links and the XML sitemap. Monitor crawl errors, indexing,
   traffic and broken links after launch.

## Verification and changes

Before launch, check representative pages for metadata, canonical URLs,
indexability, structured data, mobile usability, accessibility, performance,
both languages, sitemap entries and redirects. Record actual measurements.
Privacy/legal requirements, retention periods, monitoring ownership and
provider costs must be validated before implementation. Obtain owner approval
before changing this strategy, and update the architecture and keyword map
when affected.
