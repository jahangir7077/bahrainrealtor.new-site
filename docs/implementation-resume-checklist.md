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
   [ ] Review and apply the new forward migration to an authorized isolated
   development database before exercising its live RPC/view integration.
3. [~] Frontend/backend integration — public repository, SSR templates,
   metadata/schema/links, sitemap inclusion, and CMS workflows are connected
   in code. Validate migration-backed behavior against the approved isolated
   environment; Hostinger and hosted Supabase behavior remain unverified.
4. [~] Secure media — server-side validation/re-encoding and private-original
   protections are implemented with a forward migration. Verify Supabase Free
   quota/limits, account settings and a complete backup/restore cycle.
5. [x] Bilingual publishing — site-content also enforces independent locale
   approval and exact-revision Arabic human review before publishing.
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
9. [x] Dynamic metadata/schema/sitemap/internal links — routed content uses
   CMS SEO fields, WebPage and BreadcrumbList schema, eligible hreflang,
   same-section related links and published-route sitemap entries; indexing
   remains gated by publication and `SEO_INDEXING_ENABLED`.
10. [ ] Semantic SEO, NLP, entities, AEO and GEO — apply to researched,
    human-approved page content; do not generate or publish market/legal claims.
11. [ ] Competitor benchmarking — no verified competitor observations are in
    the repository; perform source-based review and record actionable changes.
12. [~] Design/responsive UX — bilingual design system and templates exist.
    Complete representative-page responsive, keyboard and visual acceptance.
13. [~] Automatic SEO/tracking — site-content metadata and sitemap paths are
    CMS-driven. Confirm end-to-end migration-backed publishing before any
    activation; GA4, conversion events, Search Console, Bing and IndexNow
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
remain unverified. The new site-content migration is forward-only, unexecuted
in hosted environments, and must be reviewed before applying to the
authorized development database. No CMS content has been published; indexing
remains disabled by default. Resume at the uncompleted migration-backed
integration validation in item 3, then continue the remaining checklist.
