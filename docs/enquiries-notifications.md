# Enquiry and notification operations

The public endpoint is `POST /api/enquiries` and accepts a bounded JSON
payload. It requires the exact configured `APP_ORIGIN` and same-origin fetch
metadata, a live database connection, and a database-atomic per-client limit.
The application hashes the adapter's direct client address with
`ENQUIRY_RATE_LIMIT_SECRET`; forwarded-IP headers are not trusted. Do not enable
the form until the new migration has been reviewed and applied through the
separately approved hosted-migration process.

Configure these server-only environment variables:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for trusted server-side
  enquiry insertion and queue processing. Never expose the service key to the
  browser.
- `APP_ORIGIN` as the exact HTTPS site origin.
- `ENQUIRY_RATE_LIMIT_SECRET` as an independently generated secret of at
  least 32 characters.
- `ENQUIRY_NOTIFICATION_ENDPOINT` as a fixed HTTPS provider endpoint, with no
  credentials or query string.
- `ENQUIRY_NOTIFICATION_BEARER_TOKEN` as the provider credential.
- `ENQUIRY_WORKER_TOKEN` as an independent random secret of at least 32
  characters.

Run notification delivery by POSTing an empty request body to
`/api/internal/enquiry-notifications` with the configured bearer credential. A
scheduled caller should retry this bounded batch endpoint; it handles up to ten
rows per database claim, while the HTTP worker claims at most four at a time so
sequential deliveries remain within the database's two-minute lease with
timeout margin. Delivery uses the configured endpoint only, resolves and pins
a public IP address,
rejects redirects, applies an eight-second timeout, and caps response reads.
The provider receives an `enquiry.created` JSON event and an idempotency key.
It should treat repeat deliveries with the same enquiry ID as duplicates.

The outbox and enquiry are inserted atomically. Delivery attempts are leased
and tracked as `pending`, `sending`, `delivered`, or `failed`, with bounded
exponential retries and an eight-attempt ceiling. A delivery remains pending
if provider configuration is absent. No provider response body, bearer
credential, client address, or enquiry content is written to application logs.
The localized consent wording is server-owned and recorded with each enquiry;
its privacy/legal wording still requires owner review before production use.

This repository change does not apply the migration, configure a provider or
worker schedule, enable a public enquiry form, deploy code, or validate vendor
retention, privacy terms, or delivery SLAs.
