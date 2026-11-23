# SEO, AEO, and technical strategy

## Status

These are proposed baseline requirements, pending project owner approval.
They do not establish an approved sitemap, keyword research, business
offerings, technology stack, or performance baseline. Use the
[architecture](website-architecture.md) and [keyword map](keyword-map.md)
as the sources for approved URLs and search intent.

## Search and content

- Create content for the approved audience and intent of each page. Use its
  mapped terms naturally in relevant headings, copy, title, and description;
  avoid keyword stuffing and duplicate pages targeting the same intent.
- Give each indexable page a descriptive, unique title and meta description,
  a clear primary heading, and useful internal links to relevant approved pages.
- Publish accurate, original, useful information. Verify claims, property
  details, availability, contact information, and business credentials with
  the owner; never fabricate them.

## Answer engine optimization (AEO)

- Answer the page's main question clearly and early, then provide useful
  supporting detail in descriptive sections. Use FAQs only where they help
  visitors and the answers can be verified.
- Make content understandable without relying solely on images or scripts.
  Use semantic headings and accessible text, and keep information current.
- Add structured data only when it accurately describes visible content and
  is appropriate for the page. Validate it against the relevant schema and
  search engine requirements; markup does not guarantee a rich result.

## Technical requirements

- Make approved indexable pages discoverable through normal links, return
  appropriate HTTP status codes, and provide crawlable, renderable content.
  Set a consistent preferred canonical URL and avoid duplicate URL variants.
- Provide an XML sitemap containing canonical, indexable URLs and a robots.txt
  that does not block resources needed to render those pages. Use an
  appropriate noindex mechanism for pages that should not appear in search;
  do not rely on robots.txt alone for deindexing.
- Use HTTPS, responsive layouts, accessible semantic HTML, descriptive link
  text, and meaningful image alternatives. Optimize images and minimize
  unnecessary scripts and layout shifts.
- Measure Core Web Vitals with field data when available, aiming for Google's
  good thresholds at the 75th percentile: LCP at most 2.5 seconds, INP at
  most 200 milliseconds, and CLS at most 0.1.
- Before replacing an existing site, inventory its URLs and agree on mappings.
  Preserve relevant URLs where possible; use permanent redirects for approved
  replacements, update internal links and the sitemap, and verify redirects.

## Verification and changes

Before launch, check representative pages for metadata, canonical URLs,
indexability, structured data where used, mobile usability, accessibility,
performance, sitemap entries, and redirects. Record actual measurement results
rather than promising rankings or results. Obtain owner approval before changing
this strategy, and update the architecture and keyword map when affected.
