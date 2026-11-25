# BahrainRealtor.com — Astro foundation

Phase 0 is complete. Phase 1A passed basic Hostinger SSR compatibility, but
full production readiness remains unverified. Phase 1B.1 is complete and
persisted remotely. Phase 1B.2 is implemented, persisted remotely and
conditionally accepted with documented limitations. Phases 1B.3–1B.7 are
implemented and conditionally accepted. Phases 2–5 are explicitly authorized
for combined backend implementation. Phases 1B.8, 1B.9 and 6 remain
unauthorized. The website is not production ready.
The existing live site remains on Netlify until an approved cutover.

## Local development

Use Node.js 24.x and npm:

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
HOST=127.0.0.1 PORT=4321 npm run start
```

`npm test` runs the existing Node test suite. `npm run preview` is available
for a built application. Copy `.env.example` to `.env` and add credentials only
to that ignored local file or a secure environment. Without configuration,
database-backed routes fail closed. The owner reports that the five migrations
were applied to the development project; this has not been independently
verified here. Do not execute additional hosted migrations without approval.

## Structure and limitations

- `src/pages/`: bilingual frontend, published property routes and administrator
  authentication and property draft interfaces.
- `src/layouts/`, `src/components/`, `src/styles/`: shared accessible markup,
  reusable UI components and native CSS.
- `src/config/`, `src/types/`, `src/utils/`: typed language/site configuration.
- `src/middleware.ts`: no-store and noindex response headers.
- `tests/`: production server HTTP tests.
- `/dev/design-system`: local development showcase; production responds 404.
- `experiments/hostinger-astro-ssr/`: independent Phase 1A experiment.

See [`docs/design-system.md`](docs/design-system.md) for visual tokens,
typography, component variants, contrast notes and current limitations.
Playfair Display, Inter and Tajawal font binaries remain unavailable, so
temporary fallbacks are in use. CodeQL analysis remains incomplete.

Canonical, hreflang, schema and sitemap eligibility utilities are prepared but
not activated for production. The backend implementation includes
administrator sign-in and TOTP, property revisions and locale-aware publishing,
private media management, published property search and galleries, enquiry
intake and lead management, notification retry infrastructure, article/FAQ
publishing, and private area/project/settings drafts. The reported hosted
migration and admin setup have not been independently verified. Local SQL
tests use stubbed Supabase roles/authentication; HTTP tests use mock backends.

The website is not production-ready. The email provider and worker schedule
are unconfigured; the forward migration restricting direct public access to
private media has not been applied to the hosted project. Media optimization,
real TOTP/cookie behavior, concurrent hosted publishing, admin
bootstrap/recovery, privacy/legal requirements and Hostinger runtime and
deployment controls still need hosted validation. No public project/area/settings
routes, strategic URL changes, redirects or production indexing are authorized.
Follow [`docs/frontend-backend-integration.md`](docs/frontend-backend-integration.md)
for the development setup and migration restrictions. See the architecture,
keyword map and SEO strategy in `docs/`; provisional keywords do not approve
new landing pages or final content.

## Hostinger compatibility

The Phase 1A experiment passed basic SSR compatibility, but this foundation
has not been deployed or verified on Hostinger and is not production-ready.
The intended configuration is Astro, Node.js 24.x, npm, root `./`, build
`npm run build`, output directory `dist`, and entry `server/entry.mjs`, with
the standalone Node adapter. Explicitly set output and entry in Hostinger;
the Phase 1A auto-detection left the entry empty and caused HTTP 403.

Outstanding gates include same-URL caching and `Cache-Control` behavior,
resource limits and performance, deployment and rollback, staging access
restrictions, approval-gated production deployment and prevention of automatic
deployment, and Supabase integration validation.
Keyword map validation also remains pending.

Hostinger documents an `is_enabled` setting for
[Git auto-deployment](https://docs.hostinger.com/api-reference/endpoints/hosting/git/update-git-auto-deployment-settings);
its documented default is enabled. No Hostinger account setting has been
inspected or changed here. Before any separately approved production deployment,
verify that auto-deployment is disabled for the actual site and confirm the
manual deployment and rollback procedure.
