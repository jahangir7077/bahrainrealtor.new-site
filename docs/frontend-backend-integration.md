# Backend integration and Supabase setup

## Current boundary

The application is Astro SSR with typed content contracts in
`src/types/content.ts`. Backend foundations are implemented, but this is not
production-ready. The owner reports that all five migrations were executed and
the administrator authorized in the development project; this session has not
independently verified those operations. Do not send credentials in
conversation messages.

The existing production site remains on Netlify. No deployment, DNS change,
production indexing, production database operation, or PR merge is authorized.
The identified development project is `bahrainrealtor-dev`
(`tiojcfemilttggcuqycq`); do not create another project.

## Content contracts

The shared contracts cover property records and localized property content,
images and availability, areas, projects, articles, FAQs, enquiry payloads,
publication versions, and repository interfaces. Implementations should
preserve these invariants:

- Shared factual fields belong to the record; English and Arabic descriptive
  and SEO content remain independent.
- Each locale has its own publication revision and approval. Arabic routes
  require human review of the exact published revision.
- Only published route-eligible content may be returned to public page
  components. Indexing and language equivalence have stricter eligibility
  requirements than route visibility.
- Stable property routes use `/properties/{descriptive-slug}-{immutable-id}/`;
  availability changes must not change the immutable identifier or URL.
- Missing localized content must stay unavailable rather than falling back to
  another language.

The presentation layer currently filters properties, articles and FAQs by
locale-specific publication state. Future repository implementations should
still scope public queries to eligible content and must never expose drafts or
previews anonymously.

## Implemented backend boundary

The server-side Supabase adapters use only the publishable key for public
reads and user-scoped administrator requests. The enquiry and notification
workers use a separate service-role key only on the server. Never place that
key in browser code or a public `PUBLIC_*` variable.

The current migrations are ordered:

1. `supabase/migrations/20261124000100_backend_foundation.sql`
2. `supabase/migrations/20261124000200_enquiry_flow.sql`
3. `supabase/migrations/20261124000300_media.sql`
4. `supabase/migrations/20261124000400_editorial.sql`
5. `supabase/migrations/20261124000500_property_search_archive.sql`

They provide administrator membership/MFA policies, immutable content
revisions and per-locale publication, enquiry and notification queues,
private media metadata and storage policies, editorial/site-content records,
property search and archive safeguards. Hosted execution is owner-reported,
not independently verified here. Do not run further hosted migrations without
separate approval.
Local SQL tests use stubbed Supabase roles and authentication unless a real
local Supabase stack is explicitly stated; they are not hosted-integration
tests.

The public property listings query only published content, support bounded
search and filters, exact decimal price sorting, pagination and related
properties. Uploads and public delivery decode images on the server, rotate
according to EXIF orientation, resize to at most 1600×1200, re-encode as WebP
and strip source metadata. This uses the application’s Sharp dependency rather
than paid Supabase Image Transformations. Configure
`SUPABASE_SERVICE_ROLE_KEY` only in the server runtime: public delivery first
checks the safe, published metadata view, then the service client reads the
private original and streams only the re-encoded image. The new forward
migration `supabase/migrations/20261125000100_secure_media_delivery.sql`
revokes anonymous access to original object paths and media rows; apply it to
the existing development project after review and explicit migration
authorization. This change has been exercised against local PostgreSQL with
stubbed Supabase roles, not against the hosted project. Sharp’s native runtime
and image delivery still require validation on Hostinger.

The private `/admin/` dashboard links property, media, editorial, site-content
and enquiry management. Mutations check admin membership and MFA; public and
administrative responses are no-store/noindex. Area, project and site-setting
records are private drafts; no unapproved public route or setting feed is
created. Enquiries use server-owned bilingual consent, atomic rate limiting,
spam checks, a private database outbox and a separately scheduled notification
worker. The email delivery provider and worker schedule still require owner
configuration and privacy/legal review.

## Beginner-friendly development setup

1. Install Node.js 24.x and npm. From the repository root run:

   ```sh
   npm ci
   cp .env.example .env
   ```

2. In the existing Supabase dashboard, select project
   `bahrainrealtor-dev` (reference `tiojcfemilttggcuqycq`). Under **Project
   Settings → API Keys**, copy the project URL and the **publishable** key
   into the local, ignored `.env` file:

   ```dotenv
   SUPABASE_URL=https://tiojcfemilttggcuqycq.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<project-publishable-key>
   APP_ORIGIN=http://127.0.0.1:4321
   ```

   Use the legacy `anon` key only if the dashboard does not provide a
   publishable key. Do not use `service_role` as the publishable key.

3. Run the existing frontend locally:

   ```sh
   npm run dev
   ```

   Open `http://127.0.0.1:4321/admin/login`. The dev server loads the project
   root `.env` into its server process at startup; already-set process
   variables take precedence. Restart the server after changing `.env` or
   process variables. Use the same host and port in the browser and
   `APP_ORIGIN`, and ensure the URL has no path or trailing extra characters.
   If login still returns 503, check that all three settings are present in
   the environment of the process actually running Astro, that the Supabase
   URL is HTTPS, and that `APP_ORIGIN` is exactly the local browser origin.
   Do not print or share key values. Local `.env` is ignored; never commit it.

4. The owner reports the five existing migrations were applied to the
   development project. The additional media-privacy migration is
   `20261125000100_secure_media_delivery.sql`; review and apply it only to that
   project after explicit authorization. Do not rerun the original migrations,
   target production, or create another project.

5. After an authorized migration, configure server-only secrets through the
   local `.env` or the approved environment's secret manager, never in the
   browser: `SUPABASE_SERVICE_ROLE_KEY`, `ENQUIRY_RATE_LIMIT_SECRET`,
   `ENQUIRY_WORKER_TOKEN`, and, after selecting a provider,
   `ENQUIRY_NOTIFICATION_ENDPOINT` and
   `ENQUIRY_NOTIFICATION_BEARER_TOKEN`. Use independent random secrets of at
   least 32 characters for the rate-limit and worker tokens. The provider
   endpoint must be fixed HTTPS and must not contain credentials or a query.
   Do not send any secret through chat.

6. The owner reports that the administrator was created and authorized.
   Sign in at `/admin/login`, enroll and verify TOTP at `/admin/mfa`, and
   validate the session before using admin functions. Restrict Auth redirect
   URLs to the actual local or approved preview origin. These actual Supabase
   Auth and MFA flows still require independent integration verification.

7. Configure a scheduled caller for
   `POST /api/internal/enquiry-notifications` using the worker bearer token
   only after the external provider and data-retention terms are approved.
   Review [`enquiries-notifications.md`](enquiries-notifications.md) for
   delivery and consent requirements. Review the backup/recovery procedure in
   [`backup-recovery.md`](backup-recovery.md) before configuring backups.

## Validation and remaining gates

Run `npm run check`, `npm test` and `npm run build` for local application
validation. Automated component tests use mock Supabase HTTP responses; they
do not verify a real Supabase project, MFA provider, Storage transformation,
Hostinger runtime, email provider, or scheduled delivery. The local SQL tests
are separate and must use an isolated disposable database. Do not represent
them as hosted integration tests.

Before any production use, independently validate hosted schema/security,
administrator bootstrap and recovery, TOTP and secure-cookie behavior,
concurrent publishing, Storage transformations, provider delivery and
retention, encrypted backups and restore, privacy/legal requirements,
Hostinger resource limits/caching, deployment/rollback, preview access
restrictions, and manual production deployment controls. Production indexing,
redirects, strategic URL changes, deployment and cutover remain unauthorized.

## Hostinger staging preparation

Only after separate staging authorization, use a separate access-restricted
Hostinger site and the development Supabase project, never the existing live
site or production data. Verify that Hostinger's access restriction protects
every route and that production auto-deployment is disabled before uploading
anything. Set Node 24, `npm run build`, output `dist`, and entry
`server/entry.mjs`; supply the server variables via Hostinger's protected
runtime environment, not browser-exposed variables or build-time injection.
Use the exact HTTPS staging origin for `APP_ORIGIN`. Verify HTTPS cookies,
MFA, publication, storage, no-store/noindex headers, and restricted access
before accepting the preview. Keep the prior staging artifact and configuration
securely for rollback, and verify an account-specific manual restore procedure
before deployment. Hostinger's actual controls, process restart, caching and
rollback remain unverified; do not assume noindex alone protects a preview.

## Editorial CMS integration

The editorial backend is defined by
`supabase/migrations/20261124000400_editorial.sql`; it follows the separate
enquiry and media migrations. Apply it only to an approved disposable local
database for validation. Do not run hosted migrations. Editorial categories
are bilingual and immutable, and each article/FAQ locale revision records its
category and SEO title/description. Revisions and Arabic review records cannot
be edited or deleted.

`/admin/editorial/` reuses the authenticated single-administrator workflow.
Every write checks administrator membership, current AAL2/TOTP, same-origin
form submission, and a cookie-bound CSRF token; database RPCs also enforce
administrator authorization. Approval and publication are independent per
locale. Publishing Arabic requires human review of the exact revision being
published. Publication uses compare-and-swap semantics, and unpublishing is
locale-specific and compare-and-swap guarded.

Public content is read only from the published editorial view. The bilingual
`/blog/` hub and `/blog/articles/`, `/blog/faqs/` archives are CMS-backed;
published articles also render at `/guides/{slug}/` and `/ar/guides/{slug}/`.
Content is rendered only in its published language, with no cross-language
fallback. Article details include CMS metadata and Article/Breadcrumb schema;
FAQ archives include schema for visible published answers. Public editorial
routes remain noindex unless indexing is explicitly enabled and eligible
content exists. Focused database assertions are in
`supabase/tests/editorial-security.sql`; run them only after applying the
migrations in order to a disposable local Supabase-compatible database.

## Private areas, projects, and website settings

`/admin/site-content/` manages area, project, and website-setting records
through localized immutable revisions. Records can be archived and restored;
the record, revision, and audit history are retained. The database tables are
admin-only and have no public read view or publication function. This work
does not add area/project pages, change route mappings, or make settings
publicly consumable. These records remain private drafts pending separate
authorization of any public route or publication integration.
