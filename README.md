# BahrainRealtor.com — Astro foundation

Phase 1B.1 is an isolated, non-indexable development foundation, not a
production-ready website. Phase 1B.2 and later work require separate approval.
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
- `src/layouts/`, `src/components/`, `src/styles/`: shared accessible markup
  and native CSS.
- `src/config/`, `src/types/`, `src/utils/`: typed language/site configuration.
- `src/middleware.ts`: no-store and noindex response headers.
- `tests/`: production server HTTP tests.
- `experiments/hostinger-astro-ssr/`: independent Phase 1A experiment.

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
