# Website architecture

## Status and scope

The project is a rebuild of the existing premium Bahrain real estate website
on the only approved production domain, `https://bahrainrealtor.com/`, with
English and Arabic content. `bahrainrealtor.bh` and `bahrainrealtot.com` are
not production domains.
The inventory below records the intended structure supplied by the owner. All
routes are planned, except for the explicitly authorized non-indexable
Phase 1B.1 development placeholders at `/` and `/ar/`. They do not constitute
final site design or approve any other route.

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
- Validate Supabase integration in a separately approved phase.

Phase 1B.1 is authorized only for the Astro foundation and placeholders.
Phase 1B.2 and later implementation remain unauthorized. The live Netlify site
and DNS are unchanged.

## Planned URL inventory

| Section | URL | Status |
| --- | --- | --- |
| Home | `/` | Development placeholder only; final page planned |
| Buy property | `/buy-property/` | Planned; not implemented |
| Buy property | `/buy-property/amwaj-island/` | Planned; not implemented |
| Buy property | `/buy-property/tala-island/` | Planned; not implemented |
| Buy property | `/buy-property/marassi-al-bahrain/` | Planned; not implemented |
| Buy property | `/buy-property/diyar-al-muharraq/` | Planned; not implemented |
| Buy property | `/buy-property/dilmunia-island/` | Planned; not implemented |
| Buy property | `/buy-property/manama-capital/` | Planned; not implemented |
| Rent property | `/rent-property/` | Planned; not implemented |
| Rent property | `/rent-property/amwaj-island/` | Planned; not implemented |
| Rent property | `/rent-property/tala-island/` | Planned; not implemented |
| Rent property | `/rent-property/marassi-al-bahrain/` | Planned; not implemented |
| Rent property | `/rent-property/diyar-al-muharraq/` | Planned; not implemented |
| Rent property | `/rent-property/dilmunia-island/` | Planned; not implemented |
| Rent property | `/rent-property/manama-capital/` | Planned; not implemented |
| Projects | `/projects/` | Planned; not implemented |
| Blog | `/blog/` | Planned; not implemented |
| Blog | `/blog/articles/` | Planned; not implemented |
| Blog | `/blog/faqs/` | Planned; not implemented |
| Bahrain residency | `/bahrain-residency/` | Planned; not implemented |
| Bahrain residency | `/bahrain-residency/golden-visa-bahrain/` | Planned; not implemented |
| Bahrain residency | `/bahrain-residency/self-sponsorship-visa/` | Planned; not implemented |

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
4. Obtain explicit owner approval for the foundation and for subsequent changes
   to architecture and keyword ownership before creating, removing, renaming,
   or redirecting pages.

If requirements are unclear or a requested page is absent from the approved
inventory, ask the owner rather than inventing a route or changing the
strategy. Keyword ownership remains provisional in `keyword-map.md`.
