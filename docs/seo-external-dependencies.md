# SEO external dependencies and activation gates

This register is separate from application implementation. No credentials,
verification tokens, production account changes, DNS changes, paid services or
indexing activation are authorized by this document. Keep `SEO_INDEXING_ENABLED`
off until the applicable launch gates are approved and complete.

| Integration/workstream | External dependency to obtain or verify | Safe preparation/status |
| --- | --- | --- |
| GA4 | Owner-controlled GA4 property and web stream; measurement ID; privacy/consent and retention review; approved event definitions. | No ID or tracking script is configured. Add only after consent and event scope are approved; validate in restricted staging. |
| Conversion measurement | Owner-approved definition for enquiry success and other meaningful conversion events; consent/legal review; staging test plan. | Do not treat calls, WhatsApp clicks or other outbound clicks as stored enquiries. No conversion event is activated. |
| Google Search Console | Authorized account access and selected ownership-verification method; DNS access is explicitly outside this task. | No property verification or sitemap submission has occurred. Verify only after a separately approved launch. |
| Bing Webmaster Tools | Authorized account access and approved verification method. | No account verification or sitemap submission has occurred. |
| IndexNow | Owner approval, compatible receiving endpoint, and an owner-managed key and key-file hosting plan. | No key is created, committed or served; no notifications are sent. Validate only in staging after approval. |
| Local SEO and business entities | Owner-verified business name, address/contact details, licensing/credentials, service area, and permission to publish each item; profile ownership and privacy review. | No profile, citation, credential, review or address claim is created from assumptions. |
| Competitor and experience review | Authorized page access and a non-production environment for repeatable mobile, accessibility, performance and enquiry-flow comparison. | Current benchmark records dated search-result observations only; direct competitor-page inspection was unavailable. |
| Field performance | Approved analytics/Search Console access and representative mobile/desktop field data after launch. | No Lighthouse, Core Web Vitals or search-performance measurements are claimed. |

Before any integration is enabled, document the owner, access method, consent
and data-retention decisions, staging verification, rollback, and the separate
authorization required for production activation.
