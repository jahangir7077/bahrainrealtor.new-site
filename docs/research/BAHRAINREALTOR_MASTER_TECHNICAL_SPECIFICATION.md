# BahrainRealtor.com — Master Technical Specification
Version: Planning draft 1.2 | 24 November 2026 | Status: Proposed specification; implementation NOT authorized

## 1. Project identity and non-negotiable boundaries
- Canonical production domain: https://bahrainrealtor.com/ (NOT .bh or bahrainrealtot.com).
- Rebuild the existing website; protect its current production operation and search visibility.
- Repository: https://github.com/jahangir7077/bahrainrealtor.new-site. Existing planning PR/branch: PR #1, `copilot/add-foundational-project-documents` (verify actual state before acting).
- Source of truth must be reconciled with `.github/copilot-instructions.md`, `docs/website-architecture.md`, `docs/keyword-map.md`, `docs/seo-strategy.md`, `docs/research/MASTER_PROJECT_INSTRUCTIONS_BAHRAINREALTOR_BH.txt`, and `docs/research/Bahrain_Property_Keyword_Master_PSEO.xlsx`. The historical file name containing BH does not change the approved domain. Preserve original research files and provenance; propose any rename rather than silently rewriting originals.
- The owner selected Hostinger Business Web Hosting for the rebuild. The currently live Netlify website remains in place until an explicitly approved cutover and must not be changed, interrupted, redirected, merged, or redeployed without explicit later approval. No Netlify Agent. Production code deployment is manual and approval-gated.
- GitHub Copilot should implement in reviewable phases only after separate explicit authorization. This document and first prompt authorize documentation/planning only.

## 2. Business, audience and language
- Personal-brand Bahrain real estate website for Jahangir Realtor Bahrain; buyers, tenants, sellers and investors.
- English and Arabic. Arabic equivalents use `/ar/` prefix and the SAME English slug structure, RTL presentation, localized copy and metadata.
- Use human-reviewed, translation-assisted Arabic drafts. Never automatically publish translations. English and Arabic have separate publication status and previews; only connect published equivalent pages with reciprocal hreflang and correct self-canonicals.
- Do not fabricate property listings, prices, projects, credentials, testimonials, transaction numbers, market data or inventory.

## 3. Technology and hosting architecture
- Astro for the public site on Hostinger Business Web Hosting, using a verified SSR/hybrid approach where necessary for dynamic, crawlable property and editorial pages.
- Supabase for PostgreSQL data, single-administrator authentication and media storage, subject to suitability, pricing and security validation.
- Private administration interface with access control, MFA, audit logging and secure session handling.
- Public property detail pages and dynamically published articles/FAQs must return meaningful server-rendered HTML and accurate HTTP statuses without requiring a code redeploy.
- Verify the selected Hostinger plan and account's Node.js versions and runtime, Astro adapter and SSR/hybrid compatibility, process lifecycle and resource limits, deployment and rollback controls, caching/invalidation, on-demand rendering, dynamic sitemap generation, preview isolation and costs before implementation. Do not assume static output can update itself or that Hostinger offers Netlify features.
- Secrets in server environment only; service-role keys never shipped to browser. Use least-privilege RLS, validated public read policies, authenticated write policies, abuse prevention, and secure upload handling.
- Separate development/staging and production configuration. Use a separate access-restricted preview environment; no indexing of staging, enforced by access controls (robots/noindex alone is insufficient). Verify the available Hostinger isolation and access controls before implementation.

### Phase 1A result: basic SSR compatibility PASSED (owner-reported, 24 November 2026)
- Isolated test on Hostinger Business Web Hosting: Astro 7.4.13, @astrojs/node 11.1.14, Node 24.x, npm, root `./`, build `npm run build`, output `dist`, entry file `server/entry.mjs`, ZIP upload, no environment variables. Temporary test site: https://relaxed-lightyellow-gnu-68.hostingersite.com/
- Dependency install, Astro server build, homepage, dynamic SSR route `/ssr/hostinger` and `/api/time.json` succeeded; fresh timestamps confirmed with different query parameters (2026-11-24T16:07:38.545Z and 2026-11-24T16:07:52.463Z).
- Issue: the first deployment returned HTTP 403 and build logs showed "Entry file: none" although `server/entry.mjs` was generated. Resolved via Dashboard → Redeploy → Settings and redeploy with output directory `dist` and entry file `server/entry.mjs` set explicitly. Do not rely on auto-detection.
- This is NOT full production readiness. Outstanding validation gates:
  - Investigate same-URL caching (the initial timestamp did not change on refresh).
  - Verify appropriate Cache-Control headers for dynamic property pages and API endpoints.
  - Verify runtime resource limits and performance.
  - Verify deployment and rollback procedures.
  - Verify staging access restrictions.
  - Validate Supabase integration in a separately approved phase.
- Phase 1B is not authorized. All earlier requirements remain in force.

### Hostinger compatibility research and validation gate
- Hostinger documents Node.js applications on Business and Cloud plans and lists Astro among supported frameworks; Astro documents its Node adapter for on-demand rendering. These documents do not prove this account supports the selected Astro SSR configuration end to end. Sources: [Hostinger Node.js deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [Hostinger Node.js hosting options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/), and [Astro Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/).
- Hostinger documents shared process and memory limits, a 120-second request limit, and no inbound WebSockets or always-running background workers on its web and cloud plans. Confirm current plan-specific limits, resource usage and suitability before implementation: [Hostinger Node.js limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/).
- Hostinger documents Git-based automatic deployment and file upload options. Verify a production deployment workflow that is strictly manual and approval-gated, including whether automatic deployment can be disabled. Confirm build and startup commands, supported Node.js versions, environment secrets, process restarts, preview access, rollback, logging, caching and purge capabilities. Do not configure or deploy during Phase 0.
- Validate Supabase connectivity, request-time metadata and HTTP statuses, private asset access, live publication and dynamic XML sitemap freshness in a separately authorized isolated test before committing to a runtime design. If requirements cannot be met, report the gap to the owner rather than assuming a replacement platform or weakening requirements.

## 4. Information architecture
### Primary navigation
Home; Buy Property; Rent Property; Projects; Blog; Bahrain Residency; English/Arabic switcher. Realtor profile and contact information accessible prominently (navigation/footer as UX warrants).
### Core public routes (final slugs require audit against existing indexed URLs)
- `/`
- `/buy-property/`, `/rent-property/`
- `/projects/`
- `/blog/`, `/blog/articles/`, `/blog/faqs/`
- `/bahrain-residency/`, `/bahrain-residency/golden-visa-bahrain/`, `/bahrain-residency/self-sponsorship-visa/`
- Individual listings: `/properties/{descriptive-slug}-{immutable-id}/` (slug/ID stable after publication, including price and status changes).
- Arabic equivalents under `/ar/` with corresponding English slug structures where content is reviewed and published.
### Six priority areas
Amwaj Islands; Tala Island; Marassi Al Bahrain; Diyar Al Muharraq; Dilmunia Island; Manama Capital. Candidate buy area routes: `/buy-property/amwaj-island/`, `/buy-property/tala-island/`, `/buy-property/marassi-al-bahrain/`, `/buy-property/diyar-al-muharraq/`, `/buy-property/dilmunia-island/`, `/buy-property/manama-capital/`; corresponding rent pages where warranted. Confirm slugs with current site audit and keyword mapping before finalizing. Other Bahrain locations are future research/expansion only.
### Seven planned property-type pages
`/buy-property/apartments/`, `/buy-property/villas/`, `/buy-property/houses/`, `/buy-property/land/`, `/buy-property/buildings/`, `/buy-property/commercial/`, `/buy-property/freehold/` and reviewed Arabic equivalents. These are planned, NOT automatically approved for launch/indexing. Publish only when justified by verified inventory, distinct user intent and useful unique content.
### Projects
Publish only real, verified project details; no speculative or empty project detail pages.

## 5. SEO and editorial plan
- Preserve existing useful indexed URLs and content; inventory current site before final URL mapping. Use exact-match URL retention where sensible and mapped 301 redirects where changed. Avoid blanket redirects to home.
- Carry over valuable metadata, internal links and media with rights, and validate structured data, sitemap(s), robots, canonicals, hreflang, performance, accessibility and Search Console continuity.
- Ten informational article topics: (1) Buying Property in Bahrain; (2) Freehold Areas in Bahrain; (3) Bahrain Property Investment; (4) Bahrain Property Mortgages; (5) Bahrain Property Market; (6) Bahrain Residential Communities; (7) Comparing Bahrain Property Areas; (8) Living in Amwaj Islands; (9) Amwaj Property Investment; (10) Amwaj Property Prices. Prioritize first three; publish remaining progressively after research and content/cannibalization review.
- Proposed article URL patterns `/blog/articles/{slug}/`; preserve existing article URL if it has value unless migration mapping justifies a change.
- FAQ pages should answer distinct questions and link to related guides; do not create thin or overlapping pSEO pages.
- Workbook figures are research inputs, not proof of current search volumes or rankings. Blank volumes must stay unknown; validate priority SERPs and content intent before publishing.
- New property pages: server-rendered title, body, availability, image, metadata, appropriate real-estate schema when eligible, canonical and dynamic sitemap. Do not index drafts/unpublished records or private previews.

## 6. Property data and workflow
- One private administrator at launch. Admin dashboard overview, properties, images, enquiries, articles, FAQs, settings.
- Property record: immutable internal ID and public reference; sale/rent; title and descriptions per language; location/area; property type; verified price/currency; bedrooms/bathrooms/size; amenities; photos/alt text; features; SEO fields; contact links; created/updated/published timestamps; source/verification and consent metadata where needed.
- Workflow: draft -> preview -> published; available/reserved/sold/rented/unavailable as appropriate. Separate publication and availability state.
- New listings and updates publish from dashboard without code deployment. Support image upload, ordering, cover image, replacement and removal; validate file type/size and avoid exposing unpublished assets inadvertently.
- Sold/rented: retain useful detail URLs with clear status; remove from active searches; suggest genuinely available alternatives; review stale pages periodically. Unpublished/draft must be inaccessible to anonymous users and absent from public sitemap. Removal uses justified 404/410 or appropriate relevant 301 as warranted, never misleading redirects.
- No seeded fake inventory or fictional production listings.

## 7. Enquiry management
- WhatsApp click with property title/reference; click-to-call; secure property-specific enquiry form.
- Website form enquiries stored in Supabase, shown only in private dashboard, and trigger email notifications via a verified mail provider. Do not imply WhatsApp/call clicks are automatically logged as leads.
- Enquiry status: new, contacted, follow-up, closed; include property reference, contact details, timestamps, consent/notice, anti-spam/rate limiting and retention/deletion policy.
- Avoid exposing PII in URLs, logs, analytics, or client-side keys; do not send real notifications during tests.

## 8. Editorial CMS and translations
- Dashboard manages articles and FAQs as well as listings and enquiries.
- Rich text editor supporting headings, lists, images, links and tables with sanitized output and accessible markup.
- Draft -> preview -> publish; separately reviewed English and Arabic statuses. No scheduled publishing at initial launch.
- Translation-assisted workflow: generate editable Arabic draft only via approved provider, estimate costs, document data handling and require human approval before publication. Never send customer enquiries to translation provider.
- Revision history, restore capability, editorial metadata and SEO fields, preview access control, safe internal linking.

## 9. Security, privacy, resilience
- Single admin, MFA, secure password/reset flows, role boundary and least-privilege database access.
- Supabase RLS on all relevant tables; server-side authorization for every mutation; CSRF/abuse protections appropriate to implementation; safe rendering, validated uploads, dependency checks and audit trails.
- Daily automated database backups; separate object/image backup plan; editorial/property revision history; periodic restore tests. Confirm actual vendor plan capabilities, backup retention, restoration granularity, object-storage backup method, pricing and operational owner before promising availability.
- Data minimization and privacy notice, retention/deletion policy, appropriate Bahrain privacy/legal review for personal data and marketing consent.
- Monitoring of uptime, form delivery, publish failures, SSR failures, authentication issues, storage and costs; actionable alerts.

## 10. Staging, rollout and manual deployment
- Maintain existing live bahrainrealtor.com unchanged until explicitly authorized cutover.
- Separate access-restricted preview environment; staging data and credentials separate from production; no production user data in testing. Validate Hostinger preview isolation and access controls.
- Manual deployment of code only after review and approval. Database content can update live independently of code deployment once approved and in production.
- Prelaunch acceptance: all mapped legacy URLs tested, SSR crawlability, dynamic sitemap, English/Arabic equivalence, status codes, login security, RLS, forms and notifications, image uploads, accessibility, mobile UX, Core Web Vitals, backup restore drill, rollback rehearsal and cost assessment.
- Cutover from the existing Netlify site to Hostinger must have an owner, backup, DNS and hosting configuration plan, smoke tests, monitoring, rollback triggers and explicit written approval.

## 11. Phased delivery and approval gates
Phase 0 — Planning-only audit and specification reconciliation (NOW): inspect repository/research files and current architecture; document contradictions, decisions, open questions, proposed technical design, URL inventory approach, acceptance criteria and phased tasks. NO implementation.
Phase 1 — Foundation: Astro app structure, layouts, bilingual design system, URL/SEO mapping. Requires new authorization.
Phase 2 — Supabase data, authentication, RLS, migrations, security and backup foundations. Requires review gate.
Phase 3 — Property CMS, media and SSR listings. Requires review gate.
Phase 4 — Enquiry workflow and notifications. Requires review gate.
Phase 5 — Editorial CMS, FAQs and translation-assisted review. Requires review gate.
Phase 6 — SEO validation, staging tests, migration/redirect checks, rollback and launch readiness. Production launch separately approved.
Each phase must have scope, files touched, tests, evidence, risks, costs and explicit go/no-go approval. No automatic phase continuation.

## 12. Unresolved technical decisions for planning research
1. Confirm exact repository state, existing PR status and whether planning documents conflict with newly approved decisions.
2. Inventory live URLs and identify redirects; confirm route names against actual existing URLs and Search Console exports.
3. Validate Hostinger Business Web Hosting with Astro SSR/hybrid and a compatible adapter, data caching, manual deployment controls and live updates with accurate SEO metadata.
4. Validate Supabase plan capabilities, RLS policies, admin MFA, storage image backups, database backup/restore and realistic monthly costs.
5. Choose approved translation and email providers, privacy implications, rate limits and costs. No provider integration authorized yet.
6. Define exact sitemap strategy for SSR pages and editorial content, and noindex/404/410 rules.
7. Resolve preview access controls and staging/production separation without affecting current Netlify site.
8. Verify scope of existing .com articles, SEO equity, ownership and content rights before migrating.
9. Confirm dashboard design and accessible Arabic RTL editing behavior.
10. Define data retention, privacy policy and consent flows with jurisdiction-appropriate review.

## 13. Approval rule
This specification is a planning baseline, not permission to build. Copilot's first task is READ, COMPARE, DOCUMENT and REPORT ONLY. Do not create Astro components, install packages, configure Supabase, Hostinger or Netlify, alter production, merge branches or publish content until a later explicit authorization.
