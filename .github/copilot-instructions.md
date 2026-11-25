# Copilot project instructions

Before designing or implementing the site, read and follow:

1. [Website architecture](../docs/website-architecture.md) for the intended
   site structure and route status.
2. [Keyword map](../docs/keyword-map.md) for the status of keyword ownership.
3. [SEO, AEO, and technical strategy](../docs/seo-strategy.md) for content and
   implementation requirements.

## Confirmed project decisions

## Current phase authorization

- Phase 0 — planning: complete.
- Phase 1A — basic Hostinger SSR compatibility: passed (owner-reported).
- Phase 1B.1 — Astro application foundation: complete and persisted remotely.
- Phase 1B.2 — design system and visual identity: implemented, persisted
  remotely and conditionally accepted with its documented limitations.
- Phase 1B.3 through Phase 1B.7 — bilingual frontend: implemented and
  conditionally accepted with its documented limitations.
- Phases 2–5 — database, authentication, property CMS, enquiries and
  editorial CMS: explicitly authorized as one combined backend implementation.
- Owner authorization dated 2026-11-25 explicitly extends development scope to
  finalize the workbook-based keyword/URL map and implement approved public
  routes, templates, technical SEO, analytics readiness, performance,
  accessibility and security work. This authorization does not permit
  production deployment, DNS changes, production indexing activation, hosted
  migrations, external account changes, paid services or publishing unverified
  content.

All approved development decisions remain subject to the existing keyword
evidence, privacy, editorial and production safeguards. Keep indexing disabled
by default and demonstrations non-indexable and unavailable in production
where required. Prepare forward migrations only; do not execute hosted
migrations. Never bypass platform permissions.

- Production domain: `https://bahrainrealtor.com/`; this is a rebuild of the
  existing website on the same domain. Do not use `bahrainrealtor.bh` or
  `bahrainrealtot.com` as production domains.
- Premium Bahrain real estate website in English and Arabic. Arabic
  equivalents use `/ar/` with matching English slugs when approved and
  human-reviewed.
- Astro for the public website, Supabase for database, authentication and
  storage, and Hostinger Business Web Hosting for the rebuild, subject to
  runtime, security and cost verification. The existing live site remains on
  Netlify until an explicitly approved cutover.
- Production code deployment is manual and approval-gated. Use a separate,
  access-restricted preview environment. Verify how to prevent automatic
  production deployments on Hostinger before any implementation.
- Phase 1A status: basic Astro SSR compatibility on Hostinger Business Web
  Hosting is **PASSED** (owner-reported; Astro 7.4.13, `@astrojs/node` 11.1.14,
  Node 24.x, ZIP upload; see
  `experiments/hostinger-astro-ssr/README.md`). This is **not** full
  production readiness. For Hostinger ZIP deploys, explicitly set output
  directory `dist` and entry file `server/entry.mjs`; auto-detection left the
  entry file empty and caused HTTP 403. Outstanding gates: same-URL caching,
  `Cache-Control` for dynamic pages and APIs, resource limits and performance,
  deployment and rollback, staging access restrictions, and Supabase
  integration validation. The application foundation itself
  has not been validated on Hostinger.
- A private dashboard for one administrator manages properties, enquiries,
  articles and FAQs. Approved content publishes without a code redeployment.
- Property listings are managed manually. Stable public property URLs use
  `/properties/` and an immutable unique ID.
- Content uses Draft → Preview → Publish. English and Arabic publication
  approval is independent; Arabic drafts may be translation-assisted but
  require human review.
- Preserve useful sold/rented pages with accurate status labels. Protect
  enquiries, backups, image backups and revision history according to the
  approved architecture, subject to validation.

The route inventory and keyword map reflect the owner-authorized development
scope; route implementation status must remain explicit. Use the existing
research workbook as evidence, and do not invent search metrics or property
facts. Do not expose new routes in the sitemap or enable indexing until
publication, unique-content, inventory and production gates are satisfied.

Create, remove, rename, or redirect pages only when the change is explicitly
approved and reflected in the architecture and keyword map. Preserve valuable
existing `bahrainrealtor.com` URLs and use mapped 301 redirects only where
necessary; do not redirect unrelated URLs to the homepage. Do not invent
routes, locations, services, property details, business claims, keyword
metrics, or search rankings. Treat runtime capabilities, vendor costs,
privacy/legal requirements and final URL mappings as pending validation unless
documented as approved. When requirements or approvals are missing, ask the
owner instead of making strategic decisions.

For changes affecting these documents, keep architecture, keyword ownership
and SEO requirements consistent. The 2026-11-25 owner authorization covers
development changes within scope, but not production activation or external
account operations. Preserve existing behavior where applicable and verify
relevant SEO and technical requirements before considering work complete.
