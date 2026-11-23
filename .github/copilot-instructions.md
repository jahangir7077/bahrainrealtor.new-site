# Copilot project instructions

Before designing or implementing the site, read and follow:

1. [Website architecture](../docs/website-architecture.md) for the intended
   site structure and route status.
2. [Keyword map](../docs/keyword-map.md) for the status of keyword ownership.
3. [SEO, AEO, and technical strategy](../docs/seo-strategy.md) for content and
   implementation requirements.

## Confirmed project decisions

- Production domain: `https://bahrainrealtor.com/`; this is a rebuild of the
  existing website on the same domain. Do not use `bahrainrealtor.bh` or
  `bahrainrealtot.com` as production domains.
- Premium Bahrain real estate website in English and Arabic. Arabic
  equivalents use `/ar/` with matching English slugs when approved and
  human-reviewed.
- Astro for the public website, Supabase for database, authentication and
  storage, and Netlify for hosting, all subject to runtime, security and cost
  verification.
- Production code deployment is manual and approval-gated. Use a separate,
  access-restricted preview environment.
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
architecture, keyword ownership, and strategy before starting site design or
implementation; do not treat planned routes or provisional entries as
implementation approval.

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
