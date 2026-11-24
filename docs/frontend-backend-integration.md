# Backend integration and Supabase setup

## Current boundary

The application is Astro SSR with typed content contracts in
`src/types/content.ts`. Backend foundations are implemented, but this is not
production-ready. The migrations are version-controlled and **have not been
executed against any hosted Supabase project**. Do not send credentials in
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
property search and archive safeguards. No hosted migration has been run.
Local SQL tests use stubbed Supabase roles and authentication unless a real
local Supabase stack is explicitly stated; they are not hosted-integration
tests.

The public property listings query only published content, support bounded
search and filters, exact decimal price sorting, pagination and related
properties. Public images are served via short-lived transformed signed URLs
for media attached to an exact published locale revision. Transform delivery
depends on the project's Supabase Image Transformations support; it fails
closed if unavailable. Originals remain in private storage.

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

   Open `http://127.0.0.1:4321`. Without a valid project URL and publishable
   key, database-backed routes intentionally fail closed. Local `.env` is
   ignored; never commit it.

4. **Do not run `supabase link`, `supabase db push`, or otherwise execute a
   hosted migration yet.** The owner must first authorize hosted development
   migration execution. When explicitly authorized, use the existing project
   reference above, review every migration in order, and follow the approved
   migration process. Do not create a replacement project or target production.

5. After an authorized migration, configure server-only secrets through the
   local `.env` or the approved environment's secret manager, never in the
   browser: `SUPABASE_SERVICE_ROLE_KEY`, `ENQUIRY_RATE_LIMIT_SECRET`,
   `ENQUIRY_WORKER_TOKEN`, and, after selecting a provider,
   `ENQUIRY_NOTIFICATION_ENDPOINT` and
   `ENQUIRY_NOTIFICATION_BEARER_TOKEN`. Use independent random secrets of at
   least 32 characters for the rate-limit and worker tokens. The provider
   endpoint must be fixed HTTPS and must not contain credentials or a query.
   Do not send any secret through chat.

6. Create the one authorized administrator in Supabase Auth. After migrations
   are explicitly authorized and applied, have the owner grant that user
   membership by inserting their Auth user UUID into
   `public.admin_profiles` with `authorized = true` using a restricted
   administrative session. Sign in at `/admin/login`, enroll and verify TOTP
   at `/admin/mfa`, and validate the session before using admin functions.
   Restrict Auth redirect URLs to the actual local or approved preview origin.

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

Public content is read only from the published editorial view. The approved
archive interfaces are `/blog/articles/`, `/blog/faqs/` and their `/ar/`
equivalents. Content is rendered only in its published language, with no
cross-language fallback. No individual article URL is introduced here, and
these interfaces remain non-indexable until the separate production SEO and
route approvals are complete. Focused database assertions are in
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
