# Frontend/backend integration handoff

## Current boundary

The frontend is Astro SSR with typed TypeScript content contracts in
`src/types/content.ts`. It currently uses no database, Supabase SDK,
authentication, secrets, or backend service. Homepage property search and
enquiry previews are disabled and do not send or retain personal information.
Do not treat example development states as live backend responses.

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

## Integration seam

`PropertyRepository` and `EditorialRepository` define the current read-side
interfaces. A later backend task can implement these behind server-only
adapters, keeping Supabase credentials out of browser code. Search controls
need a repository-backed query before they can return results. Enquiry
handling requires an approved secure endpoint, server-side validation,
consent and anti-abuse controls before a submission UI can be enabled.

No Supabase project, schema, migration, authentication flow, storage bucket,
administrator dashboard, publishing workflow, or enquiry transport is
implemented by this frontend task. Those remain for a separately authorized
backend phase.

