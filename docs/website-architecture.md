# Website architecture

## Status and scope

The project is a rebuild of the existing premium Bahrain real estate website
on the only approved production domain, `https://bahrainrealtor.com/`, with
English and Arabic content. `bahrainrealtor.bh` and `bahrainrealtot.com` are
not production domains.
The inventory below records the intended structure supplied by the owner.
Phase 1B.2's design system is implemented, persisted remotely and
conditionally accepted with its documented limitations. Phases 1B.3–1B.7 are
implemented and conditionally accepted. The owner explicitly authorized
Phases 2–5 for combined backend implementation, including property listings
using the approved stable property pattern. The 2026-11-25 authorization also
covers completion of the workbook-based keyword map, mapped public routes and
SEO implementation; publication, indexing and production safeguards remain
in force.

The rebuild is planned for Astro with Supabase-backed content on Hostinger
Business Web Hosting. The existing live site remains on Netlify until an
explicitly approved cutover; do not change it during planning. The final
SSR/hybrid runtime, Node.js and adapter compatibility, deployment controls,
caching and live-update behavior, preview isolation, vendor capabilities,
security controls and costs remain subject to validation.

### Phase 1A hosting status

Basic Astro SSR compatibility on Hostinger Business Web Hosting is **PASSED**
(owner-reported, isolated test in `experiments/hostinger-astro-ssr/`): Astro
7.4.13, `@astrojs/node` 11.1.14, Node 24.x, npm, ZIP upload, no environment
variables. The homepage, `/ssr/hostinger` and `/api/time.json` worked and
fresh server timestamps were confirmed. This is **not** full production
readiness. Hostinger ZIP deploys require output directory `dist` and entry
file `server/entry.mjs` to be set explicitly. Outstanding gates:

- Investigate same-URL caching: the initial timestamp did not change on refresh, although different query parameters returned fresh values.
- Verify appropriate `Cache-Control` headers for dynamic property pages and API endpoints.
- Verify runtime resource limits and performance.
- Verify deployment and rollback procedures.
- Verify staging access restrictions.
- Validate Supabase integration in an isolated development environment.

Phase 0 and Phase 1B.1 are complete; Phase 1B.1 is persisted remotely. Phases
1B.3–1B.7 are implemented and conditionally accepted. Phases 2–5 were
authorized as one combined backend scope. The owner authorization dated
2026-11-25 additionally authorizes the previously gated public website,
keyword/URL mapping, SEO, analytics readiness, performance, accessibility and
security development. It does not authorize production deployment, DNS
changes, production indexing activation, hosted migration execution, external
account changes or publishing unverified content. The application itself has
not yet been validated on Hostinger. The live Netlify site and DNS are
unchanged.

### Phase 1B.3 bilingual foundation

The owner explicitly authorized the combined Phase 1B.3–1B.7 frontend
implementation. The bilingual foundation includes
centralized locale configuration, type-safe interface dictionaries,
locale-aware routing and language-equivalent resolution, language switching,
localized metadata, canonical and hreflang utilities, publication eligibility
rules, currency/number/date/plural formatting, localized HTTP 404 presentation,
RTL/LTR compatibility, automated tests and bilingual architecture
documentation. The combined scope also authorizes the global navigation and
footer, the English and Arabic homepage at `/` and `/ar/`, development-only
template demonstrations, reusable backend-ready page templates and technical
SEO utilities. The owner authorization dated 2026-11-25 now also authorizes
keyword-led public route development in the mapping recorded by
[keyword-map.md](keyword-map.md). Preserve the approved Phase 1B.2 design
system, editorial eligibility, privacy boundaries, and noindex default.
Mapped landing routes must not enter the sitemap or become indexable until
verified inventory and unique, human-approved content are present.

The approved decisions are:

- The production domain is `https://bahrainrealtor.com/`; English is the
  default, with root English routes and Arabic routes under `/ar/` using
  matching English slugs. Existing route approval rules still apply.
- English uses `en-BH` and LTR; Arabic uses `ar-BH` and RTL, with Western
  numerals for Arabic property numerals. Use BHD, the `Asia/Bahrain` time
  zone and the Gregorian calendar.
- Select language by URL without automatic language redirects or a need for
  language preference cookies or tracking.
- Indicate unavailable translations; do not silently fall back to English
  content. AI-assisted translations require human review, and English and
  Arabic publication approvals are independent.
- Use reciprocal hreflang only for eligible published equivalents and
  independent localized canonical URLs.

## Planned URL inventory

| Section | URL | Status |
| --- | --- | --- |
| Home | `/` | Implemented bilingual development preview; no verified listings/contact data; noindex |
| Buy property | `/buy-property/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Buy property | `/buy-property/amwaj-island/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Buy property | `/buy-property/tala-island/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Buy property | `/buy-property/marassi-al-bahrain/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Buy property | `/buy-property/diyar-al-muharraq/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Buy property | `/buy-property/dilmunia-island/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Buy property | `/buy-property/manama-capital/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Rent property | `/rent-property/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Rent property | `/rent-property/amwaj-island/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Rent property | `/rent-property/tala-island/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Rent property | `/rent-property/marassi-al-bahrain/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Rent property | `/rent-property/diyar-al-muharraq/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Rent property | `/rent-property/dilmunia-island/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Rent property | `/rent-property/manama-capital/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Projects | `/projects/` | CMS route implemented; unpublished until reviewed unique content is ready |
| Blog | `/blog/` | Implemented bilingual CMS-backed hub; noindex by default |
| Blog | `/blog/articles/` | Implemented CMS-backed archive; noindex by default |
| Blog | `/blog/faqs/` | Implemented CMS-backed archive; noindex by default |
| Bahrain residency | `/bahrain-residency/` | CMS route implemented; unpublished pending verified, reviewed content |
| Bahrain residency | `/bahrain-residency/golden-visa-bahrain/` | CMS route implemented; unpublished pending legal/content verification |
| Bahrain residency | `/bahrain-residency/self-sponsorship-visa/` | CMS route implemented; unpublished pending legal/content verification |

The immutable site-content route catalog also contains all 58 mapped
`/buy-property/` targets in `keyword-map.md`. Those mapped area/intent pages use
the same localized CMS publication workflow; they are not public until a
specific approved route has independently approved English content and, for
Arabic, an exact-revision human review. Routes without published content return
not found. The forward migration
`supabase/migrations/20261125000200_site_content_publication.sql` defines the
allowlist and publication view; it has not been run against a hosted database.

### Additional approved route patterns

- Individual properties use stable URLs under
  `/properties/{descriptive-slug}-{immutable-id}/`. Availability changes must
  not change the unique ID or published URL.
- Arabic equivalents use `/ar/` followed by the matching English slug
  structure. An Arabic route is indexable only after its content is reviewed
  and independently approved for publication.
- Seven property-type landing pages are conditional, not automatic launch
  pages: apartments, villas, houses, land, buildings, commercial and
  freehold. Publish only with verified inventory, distinct intent and useful
  unique content.
- Future project detail pages use verified project slugs only. No placeholder
  or speculative project page may be published.

  ### Frontend implementation status

  The English and Arabic homepage routes (`/` and `/ar/`) now share a responsive
  Astro component system. Reusable property, area, project, editorial, FAQ and
  content-landing templates are available for later approved route work; they
  are not themselves additional public routes. Local template demonstrations
  are available only at `/dev/templates/` and `/ar/dev/templates/` and return
  HTTP 404 in production builds. The existing `/dev/design-system/` showcase
  has the same production restriction.

  Public property and editorial routes read from their published Supabase
  views. The CMS-backed blog hub, article/FAQ archives, bilingual
  `/guides/{slug}/` details, and allowlisted area/project/landing routes use
  locale-specific publication eligibility. Published site-content pages
  provide CMS metadata, WebPage and BreadcrumbList schema, localized
  equivalents when both languages are eligible, and links to related published
  pages. Dynamic sitemap entries use only published routes; indexing remains
  disabled by default. The site-content migration is forward-only and must be
  reviewed before authorized application to the development database. Verified
  content, inventory, profile/contact details, authorized photography,
  redirect mapping, production deployment, and Hostinger readiness remain
  incomplete. The homepage retains pending-information and empty states where
  verified business content is absent.

  Typed integration boundaries and the intended publication handoff are
  documented in [frontend/backend integration](frontend-backend-integration.md).
  Legacy URL inventory and migration decisions remain pending in the
  [URL migration map](url-migration-map.md).

### Content and administration

A private dashboard for one administrator manages properties, images, enquiries,
articles and FAQs. Content follows **Draft → Preview → Publish**, with
independent English and Arabic approval states. Human review is required for
translation-assisted Arabic drafts. Approved content must publish without a
code redeployment.

Properties may remain available at their stable URLs after being sold or
rented, with accurate status labels and removal from active searches. Drafts
and private previews are inaccessible to anonymous users and excluded from
public sitemaps. Enquiries require secure storage and notifications; database
and image backups plus revision history are required, subject to vendor and
cost validation.

The inventory does not describe the existing live site or authorize additional
routes. Ten planned informational article topics are retained: Buying Property
in Bahrain; Freehold Areas in Bahrain; Bahrain Property Investment; Bahrain
Property Mortgages; Bahrain Property Market; Bahrain Residential Communities;
Comparing Bahrain Property Areas; Living in Amwaj Islands; Amwaj Property
Investment; and Amwaj Property Prices. Prioritize the first three and publish
the remainder only after research and content/cannibalization review.

## Change control

1. Inventory the existing `.com` site before migration and confirm final
   page details, navigation and URL mappings. The `/ar/` convention and
   matching-slug approach are approved, but the complete page mapping remains
   subject to audit.
2. Record any approved changes here, including purpose and status; coordinate
   URL and language mappings with the migration plan.
3. Analyze the original keyword workbook and record approved keyword ownership
   in [keyword-map.md](keyword-map.md); review
   [seo-strategy.md](seo-strategy.md) alongside it.
4. The owner explicitly authorized development-finalization of the workbook
   keyword mapping, target URLs, route templates, topic clusters and technical
   SEO on 2026-11-25. This supersedes the earlier development approval gate for
   those activities only; production indexing, redirects based on live-site
   audit, deployment, DNS, hosted migrations and external account changes
   remain gated.

If requirements are unclear or a requested page is absent from the approved
inventory, use the authorized workbook mapping; do not invent facts, inventory,
legal claims or keyword metrics. Keyword ownership is mapped in
`keyword-map.md`; implementation and publication status remain explicit.
