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
- Phase 1B.8, Phase 1B.9 and Phase 6: not authorized.

This authorization does not permit changes to approved keyword targeting or
strategic URL architecture, production indexing, redirects, deployment, or
Phase 1B.8, 1B.9 or 6 work. Hosted migrations must not be executed yet, even
against the identified development project. Keep demonstrations non-indexable
and unavailable in production where required. Never bypass platform permissions.

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

The route inventory reflects the intended structure; most routes are planned,
not implemented. The keyword map remains provisional pending review and owner
approval. Do not treat planned routes or provisional entries as approval for
new SEO landing pages or changes to keyword targeting. Implement the authorized
backend and property routes without changing strategic URL mappings.

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
