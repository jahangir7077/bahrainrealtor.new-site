import type { AuthClient } from '../auth/session.ts';
import { one } from '../auth/security.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isEditorialUuid = (value: string | null): value is string =>
  !!value && uuidPattern.test(value);

function text(form: URLSearchParams, name: string, max: number, required = false): string | null | undefined {
  const values = form.getAll(name);
  if (values.length !== 1 || values[0].length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(values[0])) return undefined;
  const value = values[0].trim();
  if (required && !value) return undefined;
  return value || null;
}

function only(form: URLSearchParams, keys: string[]): boolean {
  const allowed = new Set(['action', 'csrf', ...keys]);
  return [...form.keys()].every((key) => allowed.has(key));
}

export function parseEditorialCategory(form: URLSearchParams) {
  if (!only(form, ['kind', 'slug', 'name_en', 'name_ar'])) return null;
  const kind = one(form, 'kind', 7);
  const slug = one(form, 'slug', 80);
  const name_en = text(form, 'name_en', 120, true);
  const name_ar = text(form, 'name_ar', 120, true);
  if ((kind !== 'article' && kind !== 'faq') || !slug || !slugPattern.test(slug) ||
      name_en === undefined || name_ar === undefined || !name_en || !name_ar) return null;
  return { kind, slug, name_en, name_ar };
}

export function parseEditorialDraft(form: URLSearchParams, mode: 'new' | 'draft') {
  const keys = mode === 'new'
    ? ['kind', 'slug', 'locale', 'category_id', 'title', 'body', 'summary', 'author_name', 'seo_title', 'seo_description']
    : ['revision', 'kind', 'locale', 'category_id', 'title', 'body', 'summary', 'author_name', 'seo_title', 'seo_description'];
  if (!only(form, keys)) return null;
  const kind = one(form, 'kind', 7);
  const slug = mode === 'new' ? one(form, 'slug', 100) : null;
  const revision = mode === 'draft' ? one(form, 'revision', 36) : null;
  const locale = one(form, 'locale', 2);
  const category_id = one(form, 'category_id', 36);
  const title = text(form, 'title', 200, true);
  const body = text(form, 'body', 20000, true);
  const summary = text(form, 'summary', 1000, kind !== 'faq');
  const author_name = text(form, 'author_name', 160, kind !== 'faq');
  const seo_title = text(form, 'seo_title', 200);
  const seo_description = text(form, 'seo_description', 500);
  if ((kind !== 'article' && kind !== 'faq') ||
      (mode === 'new' && (!slug || !slugPattern.test(slug))) ||
      (mode === 'draft' && !isEditorialUuid(revision)) ||
      (locale !== 'en' && locale !== 'ar') || !isEditorialUuid(category_id) ||
      [title, body, summary, author_name, seo_title, seo_description].some((value) => value === undefined)) return null;
  return {
    ...(kind ? { kind } : {}),
    ...(slug ? { slug } : {}),
    ...(revision ? { revision } : {}),
    locale,
    category_id,
    title: title!,
    body: body!,
    summary: summary ?? null,
    author_name: author_name ?? null,
    seo_title: seo_title ?? null,
    seo_description: seo_description ?? null,
  };
}

export function parseEditorialTransition(
  form: URLSearchParams,
  action: 'approve' | 'publish' | 'unpublish' | 'review',
) {
  const keys = action === 'publish' || action === 'unpublish'
    ? ['revision', 'confirm', 'expected']
    : ['revision', 'confirm'];
  if (!only(form, keys) || one(form, 'confirm', 3) !== 'yes') return null;
  const revision = one(form, 'revision', 36);
  if (!isEditorialUuid(revision)) return null;
  if (action === 'approve' || action === 'review') return { revision, expected: null };
  const expected = one(form, 'expected', 36);
  if (action === 'publish' && expected === 'none') return { revision, expected: null };
  if (!isEditorialUuid(expected)) return null;
  return { revision, expected };
}

export async function listCategories(client: AuthClient) {
  const result = await client.from('editorial_categories')
    .select('id,kind,slug,name_en,name_ar').order('kind').order('slug').limit(200);
  if (result.error || !Array.isArray(result.data)) throw new Error('Editorial categories unavailable');
  return result.data;
}

export async function listEditorialRevisions(client: AuthClient) {
  const result = await client.from('content_revisions')
    .select('id,item_id,locale,title,created_at,content_items!inner(kind,slug)')
    .in('content_items.kind', ['article', 'faq'])
    .order('created_at', { ascending: false }).limit(50);
  if (result.error || !Array.isArray(result.data)) throw new Error('Editorial revisions unavailable');
  return result.data;
}

export async function getEditorialRevision(client: AuthClient, id: string) {
  if (!isEditorialUuid(id)) return null;
  const revisionResult = await client.from('content_revisions')
    .select('id,item_id,locale,title,body,summary,author_name,seo_title,seo_description,created_at')
    .eq('id', id).maybeSingle();
  if (revisionResult.error) throw revisionResult.error;
  const revision = revisionResult.data;
  if (!revision) return null;
  const [itemResult, metadataResult] = await Promise.all([
    client.from('content_items').select('id,kind,slug').eq('id', revision.item_id).maybeSingle(),
    client.from('editorial_revision_metadata').select('category_id,kind')
      .eq('revision_id', revision.id).maybeSingle(),
  ]);
  if (itemResult.error) throw itemResult.error;
  if (metadataResult.error) throw metadataResult.error;
  const item = itemResult.data;
  const metadata = metadataResult.data;
  if (!item || !metadata || !['article', 'faq'].includes(item.kind) || item.kind !== metadata.kind) return null;
  const categoryResult = await client.from('editorial_categories')
    .select('id,kind,slug,name_en,name_ar').eq('id', metadata.category_id).maybeSingle();
  if (categoryResult.error) throw categoryResult.error;
  if (!categoryResult.data || categoryResult.data.kind !== item.kind) return null;
  return { revision, item, metadata, category: categoryResult.data };
}

export async function editorialPublicationState(
  client: AuthClient,
  itemId: string,
  locale: string,
  revisionId: string,
) {
  const [approval, publication, review] = await Promise.all([
    client.from('revision_approvals').select('revision_id').eq('revision_id', revisionId).maybeSingle(),
    client.from('publications').select('revision_id').eq('item_id', itemId).eq('locale', locale).maybeSingle(),
    client.from('editorial_revision_reviews').select('revision_id').eq('revision_id', revisionId).maybeSingle(),
  ]);
  if (approval.error) throw approval.error;
  if (publication.error) throw publication.error;
  if (review.error) throw review.error;
  return {
    approved: approval.data?.revision_id === revisionId,
    current: publication.data?.revision_id ?? null,
    reviewed: review.data?.revision_id === revisionId,
  };
}

export async function createEditorialCategory(
  client: AuthClient,
  category: NonNullable<ReturnType<typeof parseEditorialCategory>>,
) {
  const id = crypto.randomUUID();
  const result = await client.rpc('create_editorial_category', {
    p_id: id,
    p_kind: category.kind,
    p_slug: category.slug,
    p_name_en: category.name_en,
    p_name_ar: category.name_ar,
  });
  if (result.error) throw result.error;
  return id;
}

export async function createEditorialDraft(
  client: AuthClient,
  draft: NonNullable<ReturnType<typeof parseEditorialDraft>>,
) {
  if (!draft.kind || !draft.slug) return null;
  const itemId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const result = await client.rpc('create_editorial_draft', {
    p_item_id: itemId,
    p_revision_id: revisionId,
    p_slug: draft.slug,
    p_kind: draft.kind,
    p_locale: draft.locale,
    p_category_id: draft.category_id,
    p_title: draft.title,
    p_body: draft.body,
    p_summary: draft.summary,
    p_author_name: draft.author_name,
    p_seo_title: draft.seo_title,
    p_seo_description: draft.seo_description,
  });
  if (result.error) throw result.error;
  return revisionId;
}

export async function reviseEditorialDraft(
  client: AuthClient,
  draft: NonNullable<ReturnType<typeof parseEditorialDraft>>,
) {
  if (!draft.revision) return null;
  const revisionId = crypto.randomUUID();
  const result = await client.rpc('revise_editorial_draft', {
    p_source_revision_id: draft.revision,
    p_revision_id: revisionId,
    p_locale: draft.locale,
    p_category_id: draft.category_id,
    p_title: draft.title,
    p_body: draft.body,
    p_summary: draft.summary,
    p_author_name: draft.author_name,
    p_seo_title: draft.seo_title,
    p_seo_description: draft.seo_description,
  });
  if (result.error) throw result.error;
  return revisionId;
}

export async function transitionEditorial(
  client: AuthClient,
  action: 'approve' | 'review' | 'publish' | 'unpublish',
  input: NonNullable<ReturnType<typeof parseEditorialTransition>>,
) {
  const detail = await getEditorialRevision(client, input.revision);
  if (!detail) return false;
  if (action === 'review') {
    if (detail.revision.locale !== 'ar') return false;
    const result = await client.rpc('review_editorial_revision', { p_revision_id: input.revision });
    if (result.error) throw result.error;
  } else if (action === 'approve') {
    const result = await client.rpc('approve_revision', { p_revision_id: input.revision });
    if (result.error) throw result.error;
  } else if (action === 'publish') {
    const result = await client.rpc('publish_revision_if_current', {
      p_revision_id: input.revision,
      p_expected_revision_id: input.expected,
    });
    if (result.error) throw result.error;
  } else {
    if (!input.expected) return false;
    const result = await client.rpc('unpublish_editorial_content', {
      p_item_id: detail.item.id,
      p_locale: detail.revision.locale,
      p_expected_revision_id: input.expected,
    });
    if (result.error) throw result.error;
  }
  return true;
}
