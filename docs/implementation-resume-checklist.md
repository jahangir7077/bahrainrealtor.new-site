# Implementation resume checklist

Resume from the current branch after the CMS landing-route implementation. The
owner's development authorization is active; production, hosted migration,
DNS, external account, and publication safeguards are unchanged.

1. [x] Public page route implementation — SSR catch-all now serves only the
   immutable allowlist: all 58 mapped buy-property targets and approved buy,
   rent, project and residency routes. Unpublished routes return not found;
   content is not invented or pre-published.
2. [x] Admin/CMS publishing code — `/admin/site-content/` supports approved
   route assignment, immutable revisions, archive/restore, approval,
   Arabic exact-revision review, and locale-specific publish/unpublish.
   [x] Reviewed behavior by applying all seven migrations only to disposable
   local PostgreSQL 16 and exercising the routed RPC/view integration. Hosted
   migration remains prohibited in this task and unverified.
3. [x] Frontend/backend integration — all seven migrations and SQL security
   tests passed against disposable local PostgreSQL 16 with Supabase role/auth
   stubs. The CMS publication test exercises approved route reads and Arabic
   review. Hosted Supabase and Hostinger behavior remain unverified.
4. [~] Secure media — upload validation, application-side Sharp re-encoding,
   private-original protections, and bounded encrypted export are implemented;
   database restore passed with a synthetic encrypted archive in disposable
   local PostgreSQL 16. Verify actual Supabase Free quota/limits and account
   settings before media use; a media-object restore and hosted backup cycle
   remain untested.
5. [~] Bilingual publishing — editorial and site-content workflows enforce
   exact-revision Arabic human review. The property publication view has no
   exact-revision Arabic review marker; Arabic property details therefore stay
   noindex and out of the sitemap until that workflow exposes one. Hosted-auth
   integration remains unverified.
6. [~] Enquiries/notifications — endpoint mocks and isolated SQL tests pass
   for consent, atomic rate limiting, private outbox insertion, leasing,
   retry, stale-token rejection, and the eight-attempt ceiling. Worker batch
   size is bounded below its lease. Do not enable public forms until authorized
   migration/configuration and consent review; provider and scheduled worker
   are not configured.
7. [x] Keywords/intents — all 69 unique workbook targets have one owner and
   explicit topic-cluster membership; cluster coverage is regression-tested.
   See [keyword map](keyword-map.md).
8. [~] SEO disciplines — technical metadata/indexing safeguards exist.
   Evidence-based local/off-page readiness still requires verified business
   details, credentials, citations and owner-controlled profiles.
9. [x] Dynamic metadata/schema/sitemap/internal links — CMS metadata,
   WebPage/Article/FAQ/BreadcrumbList schema, eligible site-content/editorial
   hreflang, contextual links and published-route sitemap entries are
   implemented. Arabic property indexing is held back until exact review data
   exists; all sitemap/indexing output remains gated by publication and
   `SEO_INDEXING_ENABLED`.
10. [~] Semantic SEO, NLP, entities, AEO and GEO — templates support structured,
    accessible content; application to page copy requires verified research
    and human-approved facts. No market/legal claims are generated.
11. [~] Competitor benchmarking — dated search-result observations and safe
    implementation implications are recorded in
    [competitor benchmark](seo-competitor-benchmark.md). Direct page,
    mobile/usability and enquiry-flow comparison remains pending.
12. [~] Design/responsive UX — homepage search now submits to localized
    published-property search, and invalid filters retain a correction form.
    Corrected button styling and contrast. Local Chromium checked homepage
    layout at 320px, 768px and 1440px, RTL direction, mobile menu and skip-link
    focus; English search submission reached the expected unconfigured-backend
    503. Mock-backed search integration tests pass. Listing filter inputs and
    pagination links now meet the 44px design target; Chromium measured all
    nine filter controls at 44px and no horizontal document overflow at
    320px on both English and Arabic invalid-filter pages. Pagination was not
    browser-measured. Full visual, keyboard,
    screen-reader and authenticated admin acceptance remain pending.
    2026-11-27 homepage corrections: separate bilingual navigation; responsive
    Buy/Rent forms with localized Area and Property Type dropdowns; requested
    H1 and approved bilingual introduction; featured listings selected by an
    audited admin-only workflow, shown only on the homepage and only when
    eligible English inventory exists. The JPEG at
    `public/homepage-hero.webp.jpg` was verified and converted to optimized
    1440×810 WebP at `public/images/homepage-hero.webp` (121,388 bytes).
    Featured inventory has an empty state that omits the section. Hot Deals
    navigation points to contact until approved deal inventory exists; no
    unverified deals are asserted. Removed customer-facing “pending” copy from
    homepage sections while retaining the enquiry preview safeguards.
    `jahengir-akram-profile.jpg` is not present; no substitute portrait is
    used. Arabic property featured listings remain withheld until the exact
    revision human-review marker is available. Final Node 24.22.3 Astro check
    and production build passed; 34 focused frontend, search, admin workflow,
    localization and design-system tests passed. All eight migrations and
    every SQL test passed on a disposable local PostgreSQL 16 instance.
    Chromium screenshots were captured at 1440×1000 and 390×844 in English
    and Arabic; mobile RTL search submitted localized filters and showed no
    horizontal overflow. No hosted migration or production action was
    performed.
    2026-11-27 navigation follow-up: Buy, Rent, Investment, Projects, Home
    Loans, Explore Areas and Market Insights now link to the localized,
    approved CMS/keyword-mapped routes. Their normal publication gates remain
    enforced; links may return 404 until approved content is published.
    English/Arabic navigation URL assertions and route publication tests pass.
    About, Hot Deals and Contact remain homepage section links because no
    dedicated approved URL is in the current route/keyword map. Do not invent
    those routes; request an owner-approved mapping before creating them.
13. [~] Automatic SEO/tracking — CMS-published content drives metadata,
    eligible alternates and sitemap paths. GA4, conversion events, Search
    Console, Bing and IndexNow remain unconfigured; prerequisites and
    activation gates are recorded separately in
    [external dependencies](seo-external-dependencies.md).
14. [~] Security/accessibility — contrast and accessible-name findings were
    corrected. Current CodeQL analysis for the homepage and CMS-selection
    changes reported zero JavaScript alerts. Lighthouse checks do not establish
    WCAG 2.2 AA conformance; complete manual and assistive-technology review.
15. [~] Performance — Lighthouse 13.6.0 on the local Node 24 production
    build, 2026-11-26, indexing off and no backend: English desktop homepage
    performance/accessibility/best-practices/SEO 100/100/100/63; FCP/LCP
    0.3s, TBT 0ms, CLS 0. Arabic mobile homepage 100/100/100/63; FCP/LCP
    1.1s, TBT 0ms, CLS 0. These are single lab runs, not field measurements,
    and exclude real inventory/media. The SEO deduction is the intentional
    noindex gate; do not activate indexing to improve scores. Verify caching,
    compression and Core Web Vitals on authorized staging with real content.
16. [~] Hostinger/backup/rollback — preparation instructions and encrypted
    backup scripts exist; local database restore passed using a synthetic
    archive. Deployment settings remain Node 24, `npm run build`, output
    `dist`, entry `server/entry.mjs`; keep secrets in the protected runtime
    environment. Build/upload only to an authorized restricted staging site.
    Verify access controls, automatic-deploy state, caching, resource limits,
    rollback, hosted database backup and media restore before launch; see
    [backup and recovery](backup-recovery.md). No upload or hosted backup was
    performed.
17. [~] Final validation — Node 24.22.3 production build and Astro check
    passed (115 files, zero diagnostics); all 111 existing tests passed.
    Production preview returned 200 for `/` and `/ar/`, with noindex/no-store;
    `/properties/` and `/admin/login` correctly fail closed with 503 absent
    Supabase configuration. English desktop and Arabic mobile Lighthouse
    results are recorded above. The working local preview is
    `HOST=127.0.0.1 PORT=4321 SEO_INDEXING_ENABLED=false npm run start`
    after `npm ci && npm run build`; no credentials are needed to view the
    public shell. Hosted Supabase and Hostinger verification remain blockers.

Critical launch blockers: the Supabase publishable/server credentials and
hosted schema/auth/storage configuration are unverified, so listings and admin
return 503 without configuration. Notification provider, worker and
consent/legal review are unconfigured. Hostinger restricted-staging access,
manual deployment controls, caching/resource limits and rollback have not
been verified. Hosted database backup and media recovery are untested; local
restore used only a synthetic archive. No content is published; production
indexing stays disabled and Arabic property indexing requires exact-revision
review. The latest CodeQL analysis reported no JavaScript alerts. Resolve
remaining blockers only with explicit authorization; do not deploy, migrate or
activate indexing.
