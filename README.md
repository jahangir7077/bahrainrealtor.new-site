# BahrainRealtor.com — Astro foundation

Phase 1B.1 is the completed, isolated non-indexable application foundation.
Phase 1B.2 is authorized for the design system and visual identity only;
Phase 1B.3 and later work remain unauthorized. This is not a production-ready
website.
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

`npm test` builds the application and tests the standalone production server.
`npm run preview` is also available for a built application. No environment
variables or credentials are required by the foundation; local `.env` files
are ignored and `.env.example` contains no secrets.

## Structure and limitations

- `src/pages/`: English `/`, Arabic `/ar/`, and a custom 404.
- `src/layouts/`, `src/components/`, `src/styles/`: shared accessible markup,
  reusable UI components and native CSS.
- `src/config/`, `src/types/`, `src/utils/`: typed language/site configuration.
- `src/middleware.ts`: no-store and noindex response headers.
- `tests/`: production server HTTP tests.
- `/dev/design-system`: local development showcase; production responds 404.
- `experiments/hostinger-astro-ssr/`: independent Phase 1A experiment.

See [`docs/design-system.md`](docs/design-system.md) for visual tokens,
typography, component variants, contrast notes and current limitations.

Canonical URLs, hreflang, sitemaps, schema, redirects, property pages,
Supabase, authentication, dashboard, enquiries and publishing are future
requirements, not implemented. See the architecture, keyword map and SEO
strategy in `docs/`; placeholders do not approve keyword ownership or final
content.

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
deployment, and Supabase integration in a separately approved phase.
