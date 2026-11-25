# Implementation resume checklist

Resume from the current branch after the blog hub changes are committed. The
owner's development authorization is active; production, hosted migration,
DNS, external account, and publication safeguards are unchanged.

1. [~] Public pages/routes — property listing/detail, article/FAQ archives,
   CMS guide details, and bilingual `/blog/` hubs exist. Implement the
   remaining workbook-mapped transactional pages and architecture routes
   (`/rent-property/`, `/projects/`, `/bahrain-residency/` and mapped area
   routes); do not publish thin or unverified content.
2. [~] Admin/CMS — property, editorial, media, enquiry and private site-content
   dashboards exist. Add controlled publication for eligible area/project/
   landing content; site-content records currently remain private drafts.
3. [~] Frontend/backend — public property/editorial reads and authenticated
   admin workflows exist. Validate full application integration on an isolated
   environment; Hostinger and hosted Supabase behavior remain unverified.
4. [~] Secure media — server-side validation/re-encoding and private-original
   protections are implemented with a forward migration. Verify Supabase Free
   quota/limits, account settings and a complete backup/restore cycle.
5. [~] Bilingual publishing — property and editorial workflows enforce
   locale-specific approval and exact-revision Arabic review. Extend publishing
   to mapped area/project/landing CMS records.
6. [~] Enquiries/notifications — secure endpoint, consent record, rate-limit,
   outbox and bounded worker exist. Public forms remain disabled until
   migration/configuration and consent review; provider and scheduled worker
   are not configured.
7. [~] Keywords/intents — 64 workbook targets and ownership are recorded.
   Record explicit topic-cluster relationships and complete mapped route
   coverage without splitting synonym intents.
8. [~] SEO disciplines — technical metadata/indexing safeguards exist.
   Complete evidence-based local/off-page readiness; real profile,
   credentials, citations and authority work require verified owner data.
9. [~] Schema/sitemap/robots/links — gated endpoints and property, article,
   breadcrumb and visible FAQ schemas exist. Extend appropriate schema,
   sitemap and contextual links as mapped pages become publishable.
10. [ ] Semantic SEO, NLP, entities, AEO and GEO — apply to researched,
    human-approved page content; do not generate or publish market/legal claims.
11. [ ] Competitor benchmarking — no verified competitor observations are in
    the repository; perform source-based review and record actionable changes.
12. [~] Design/responsive UX — bilingual design system and templates exist.
    Complete representative-page responsive, keyboard and visual acceptance.
13. [~] Automatic SEO/tracking — published property/editorial metadata and
    sitemap paths are CMS-driven. Complete publishing validation across new
    content types; GA4, conversion events, Search Console, Bing and IndexNow
    remain unconfigured/unverified.
14. [~] Security/accessibility — existing security controls and regression
    tests cover key flows. Complete fresh security and accessibility review;
    CodeQL previously reported analysis failure, not a clean scan.
15. [ ] Performance — Lighthouse/Core Web Vitals targets have not been
    measured; record real mobile and desktop measurements and fix regressions.
16. [~] Hostinger/backup/rollback — preparation instructions and isolated
    encrypted backup scripts exist. Verify access-restricted staging, manual
    deployment, caching, resource limits, rollback and restore in the account;
    do not deploy without authorization.
17. [ ] Final validation — run the full existing test suite, Astro check,
    production build, secret scan and successful CodeQL after implementation;
    report actual results and unresolved external gates.

Known verified limits: no production deployment or hosted migration was done;
no competitor or performance measurements are verified; external analytics,
search-platform, notification-provider and Hostinger account configuration
remain unverified. Resume by implementing item 1's mapped CMS-backed routes
and publication eligibility, then continue sequentially through this list.
