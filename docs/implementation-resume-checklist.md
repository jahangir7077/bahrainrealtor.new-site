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
13. [~] Automatic SEO/tracking — CMS-published content drives metadata,
    eligible alternates and sitemap paths. GA4, conversion events, Search
    Console, Bing and IndexNow remain unconfigured; prerequisites and
    activation gates are recorded separately in
    [external dependencies](seo-external-dependencies.md).
14. [~] Security/accessibility — contrast and accessible-name findings were
    corrected. Lighthouse checks do not establish WCAG 2.2 AA conformance;
    complete manual and assistive-technology review. CodeQL reported no
    analyzable changed languages and did not run an analysis; a successful
    security analysis remains required.
15. [~] Performance — Lighthouse 13.6.0 on the local Node 24 production
    build, 2026-11-26, indexing off and no backend: English mobile homepage
    performance/accessibility/best-practices/SEO 100/100/100/63; FCP 1.1s,
    LCP 1.1s, TBT 0ms, CLS 0. Arabic desktop homepage 100/100/100/63; FCP
    0.3s, LCP 0.3s, TBT 0ms, CLS 0. These single lab runs were concurrent,
    not field measurements, and excluded real inventory/media. SEO deductions
    reflect intentional noindex; do not activate indexing to improve scores.
    Compression and render-blocking CSS were flagged; verify caching,
    compression and Core Web Vitals on authorized staging with real content.
16. [~] Hostinger/backup/rollback — preparation instructions and encrypted
    backup scripts exist; local database restore passed using a synthetic
    archive. Verify access-restricted staging, manual deployment, caching,
    resource limits, rollback, hosted database backup, and media restore only
    in authorized environments; do not deploy without authorization.
17. [~] Final validation — Node 24.22.3 production build and Astro check
    passed; targeted design, property and keyword-map tests passed (17 tests).
    Full suite, representative hosted testing and successful
    CodeQL analysis remain required.

Known verified limits: no production deployment or hosted migration was done;
no full-page competitor, hosted performance or field-search measurements are
verified; external analytics, search-platform, notification-provider and
Hostinger account configuration remain unverified. Arabic property indexing
is withheld pending exact-revision review data. All seven migrations and SQL
assertions have been run only against disposable local PostgreSQL 16. Database
restore testing used a synthetic archive, not hosted project data; hosted
backup, media restore, provider delivery, and account-level Free quota remain
unverified. No CMS content has been published; indexing remains disabled by
default. Resume by validating the explicitly unverified hosted/account
dependencies only after separate authorization, then continue the remaining
checklist.
