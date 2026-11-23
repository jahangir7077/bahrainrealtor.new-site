# Astro SSR compatibility test for Hostinger

This isolated application tests Astro's Node.js standalone server. It is not
the production site and contains no business or property content, database
connection, or production credentials.

## Selected versions

- Astro `7.4.13`
- `@astrojs/node` `11.1.14` (peer dependency requires Astro `^7.2.1`)
- Node.js `22.23.4` or newer in the Node 22 line, as required by Astro
  `7.4.13`; Node.js `24.22.1` was used for local verification.
- npm `11.19.1` was available locally.

The package versions are pinned for reproducibility. Recheck upstream
compatibility and security advisories before changing them.

## Run locally

```sh
npm ci
npm run dev
```

In another terminal:

```sh
curl -i http://127.0.0.1:4321/api/time.json
curl -i http://127.0.0.1:4321/ssr/hostinger
```

Run the production-mode server locally:

```sh
npm run build
HOST=127.0.0.1 PORT=4321 npm run start
```

Repeat the timestamp request after a short delay. Its `generatedAt` value
should change; the dynamic page should return HTML containing its route
parameter and request-time timestamp.

## Hostinger Business deployment configuration to verify

Hostinger's support documentation lists Node.js applications on Business and
Cloud plans and lists Astro among supported frameworks. Astro's Node adapter
supports a standalone server entry point. This does **not** establish that the
selected Hostinger account can run this exact SSR build; deployment is not
authorized as part of this test.

Hostinger documentation lists Node.js `18.x`, `20.x`, `22.x` and `24.x`.
Astro `7.4.13` requires Node `>=22.23.4`, so 18.x and 20.x are unsuitable.
For a future isolated test website, verify the exact patch version selected
in hPanel; the documented major/minor choices alone do not guarantee that the
22.x runtime meets Astro's patch-level minimum. Node.js `24.22.1` passed the
local test.

Proposed build and server details, subject to Hostinger dashboard verification:

| Setting | Value |
| --- | --- |
| Project root | `experiments/hostinger-astro-ssr/` in the repository, or this directory as the isolated repository root |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist/` |
| Node server entry point | `dist/server/entry.mjs` |
| Startup command if a command is requested | `node ./dist/server/entry.mjs` |
| Runtime environment | `HOST` and `PORT` should be provided by the platform; Astro's standalone server reads these values |
| Application secrets | None required |

Use a separate test website and Hostinger temporary/preview domain from hPanel;
do not attach `bahrainrealtor.com`, modify its DNS, or reuse production
credentials. Confirm preview access protection and prevent indexing before
sharing a test URL. If the deployment workflow automatically deploys pushes,
verify that production auto-deploy can be disabled or gated before connecting
any production repository.

To check a deployed test, request `/api/time.json` repeatedly and confirm
different timestamps and `Cache-Control: no-store`; request `/ssr/hostinger`
and verify a 200 response with server-rendered HTML containing the route
parameter. Also confirm that an unknown route returns 404.

Hostinger's published Node.js limitations include shared process and memory
limits, a maximum 120-second request duration, and no inbound WebSockets or
always-running background workers on web/cloud plans. Confirm current
Business-plan limits, Node version availability, environment-variable
handling, entry/start command behavior, access controls, restart behavior,
deployment approvals, rollback, logging, caching and CDN invalidation with
Hostinger before implementation.

## Official references

- [Astro Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/)
- [Astro on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
- [Hostinger Node.js deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Hostinger Node.js hosting options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/)
- [Hostinger Node.js version selection](https://www.hostinger.com/support/how-to-select-the-node-js-version-for-your-application/)
- [Hostinger Node.js limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/)
- [Hostinger temporary/preview domains](https://www.hostinger.com/support/2489693-how-to-access-your-website-content-without-a-domain-in-hostinger/)
