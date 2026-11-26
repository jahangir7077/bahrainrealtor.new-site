# Competitor benchmark evidence

## Scope and evidence limits

Reviewed 2026-11-26. These are dated search-result snapshots, not a crawl or
usability audit of the full competitor sites. Direct page retrieval was
unavailable during this review. Dynamic listing counts, prices, availability
and rankings are intentionally not treated as verified market facts.

| Source | Dated observation | Safe implementation implication |
| --- | --- | --- |
| [Property Finder Bahrain apartment listings](https://www.propertyfinder.bh/en/buy/apartments-for-sale.html), search result crawled 2026-11-26 11:10 UTC | The result presents Bahrain apartment listings with locality, property type and area measurements, and refers to maps and photos. | Keep property type, location and size as visible, verified listing facts. The current property detail and search templates already render these fields; do not copy changing inventory or volume counts. |
| [Property Finder Bahrain property listings](https://www.propertyfinder.bh/en/buy/properties-for-sale.html), search result crawled 2026-11-26 17:08 UTC | The result displays varied property types and locations and includes listing facts such as plot/area, price and listing recency. | Continue to show verified property facts and status from CMS records; no property facts or recency should be generated or inferred. |
| [Savills Bahrain](https://www.savills.bh/), search result crawled 2026-11-25 23:30 UTC | The result positions its service across residential and commercial/industrial property and refers to market expertise. | Keep the approved keyword map's residential and commercial ownership distinct. Do not copy competitor claims or make equivalent business/credential claims without owner evidence. |

## Applied improvements and remaining evidence

- Completed the missing reciprocal hreflang on eligible article detail pages
  and editorial hubs/archives. Links are emitted only when the corresponding
  locale has published, eligible content.
- Unavailable article responses now carry a useful localized description
  while remaining noindex and without a canonical URL.
- Arabic property detail pages are noindex and omitted from the sitemap until
  the property publishing data exposes an exact-revision Arabic review marker.
- No benchmark evidence justifies changing approved URL ownership, adding
  pages, inventing market copy, or changing the existing visible property
  facts. A live mobile/accessibility/performance/enquiry audit remains pending
  and must use an approved, non-production environment.
