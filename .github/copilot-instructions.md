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
- Phase 1B.3 through Phase 1B.7 — bilingual architecture, frontend navigation,
  homepage, reusable templates, and technical SEO foundation: explicitly
  authorized by the owner as one combined frontend implementation.
- Phase 1B.8 and later phases: not authorized.

This authorization does not permit new public SEO landing pages, changes to
approved keyword targeting or URL architecture, Supabase, administration,
actual property listings, enquiry processing, publishing, deployment or any
Phase 1B.8+ work. Keep frontend demonstrations non-indexable and unavailable
in production where required. Reconcile authorization statements when the
owner explicitly approves a new phase; never bypass platform permissions.

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
  integration (separately approved phase). The application foundation itself
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

The route inventory reflects the intended structure; its routes are planned,
not implemented. The keyword map remains provisional until the original keyword
workbook is available and analyzed. Ask the project owner to approve the
architecture, keyword ownership, and strategy before work outside the
explicitly authorized phase; do not treat planned routes or provisional
entries as approval for later implementation. The combined Phase 1B.3–1B.7
authorization includes the root homepage only; it does not authorize new
public SEO landing pages, keyword targeting or later-phase features.

Create, remove, rename, or redirect pages only when the change is explicitly
approved and reflected in the architecture and keyword map. Preserve valuable
existing `bahrainrealtor.com` URLs and use mapped 301 redirects only where
necessary; do not redirect unrelated URLs to the homepage. Do not invent
routes, locations, services, property details, business claims, keyword
metrics, or search rankings. Treat runtime capabilities, vendor costs,
privacy/legal requirements and final URL mappings as pending validation unless
documented as approved. When requirements or approvals are missing, ask the
owner instead of making strategic decisions.

For any requested change that affects these documents, obtain owner approval
and keep all three consistent. Implement only the approved scope, preserve
existing behavior where applicable, and verify relevant SEO and technical
requirements before considering the work complete.
