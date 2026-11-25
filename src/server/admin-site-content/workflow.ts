import type { AuthClient } from '../auth/session.ts';
import { one } from '../auth/security.ts';
import { siteContentRouteKind, SITE_CONTENT_ROUTES } from '../site-content/routes.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export type ManagedContentKind = 'area' | 'project' | 'setting' | 'landing';
export const isSiteContentUuid = (value: string | null): value is string =>
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

export function parseSiteContentDraft(form: URLSearchParams, mode: 'new' | 'draft') {
  const keys = mode === 'new'
    ? ['kind', 'slug', 'route_path', 'locale', 'title', 'body', 'summary', 'seo_title', 'seo_description']
    : ['revision', 'kind', 'locale', 'title', 'body', 'summary', 'seo_title', 'seo_description'];
  if (!only(form, keys)) return null;
  const kind = one(form, 'kind', 7);
  const slug = mode === 'new' ? one(form, 'slug', 100) : null;
  const route_path = mode === 'new' ? one(form, 'route_path', 120) : null;
  const revision = mode === 'draft' ? one(form, 'revision', 36) : null;
  const locale = one(form, 'locale', 2);
  const title = text(form, 'title', 200, true);
  const body = text(form, 'body', 20000, true);
  const summary = text(form, 'summary', 1000);
  const seo_title = text(form, 'seo_title', 200);
  const seo_description = text(form, 'seo_description', 500);
  if (!['area', 'project', 'setting', 'landing'].includes(kind ?? '') ||
      (mode === 'new' && (!slug || !slugPattern.test(slug) ||
        (kind !== 'setting' && (!route_path || siteContentRouteKind(route_path) !== kind ||
          slug !== route_path.slice(1, -1).replaceAll('/', '-'))))) ||
      (mode === 'draft' && !isSiteContentUuid(revision)) ||
      (locale !== 'en' && locale !== 'ar') ||
      [title, body, summary, seo_title, seo_description].some((value) => value === undefined)) return null;
  return {
    kind: kind as ManagedContentKind,
    ...(slug ? { slug } : {}),
    ...(route_path ? { route_path } : {}),
    ...(revision ? { revision } : {}),
    locale,
    title: title!,
    body: body!,
    summary: summary ?? null,
    seo_title: seo_title ?? null,
    seo_description: seo_description ?? null,
  };
}

export function parseSiteContentTransition(
  form: URLSearchParams,
  action: 'review' | 'approve' | 'publish' | 'unpublish',
) {
  const keys = action === 'publish' || action === 'unpublish'
    ? ['revision', 'confirm', 'expected']
    : ['revision', 'confirm'];
  if (!only(form, keys) || one(form, 'confirm', 3) !== 'yes') return null;
  const revision = one(form, 'revision', 36);
  if (!isSiteContentUuid(revision)) return null;
  if (action === 'review' || action === 'approve') return { revision, expected: null };
  const expected = one(form, 'expected', 36);
  if (action === 'publish' && expected === 'none') return { revision, expected: null };
  if (!isSiteContentUuid(expected)) return null;
  return { revision, expected };
}

export { SITE_CONTENT_ROUTES };

export function parseSiteContentArchive(form: URLSearchParams) {
  if (!only(form, ['item_id', 'expected_archived', 'archived', 'confirm']) ||
      one(form, 'confirm', 3) !== 'yes') return null;
  const item_id = one(form, 'item_id', 36);
  const expected = one(form, 'expected_archived', 5);
  const archived = one(form, 'archived', 5);
  if (!isSiteContentUuid(item_id) || !['true', 'false'].includes(expected ?? '') ||
      !['true', 'false'].includes(archived ?? '') || expected === archived) return null;
  return { item_id, expected_archived: expected === 'true', archived: archived === 'true' };
}

export async function listSiteContentRevisions(client: AuthClient) {
  const result = await client.from('site_content_revisions')
    .select('id,item_id,kind,locale,title,created_at')
    .order('created_at', { ascending: false }).limit(50);
  if (result.error || !Array.isArray(result.data)) throw new Error('Site content revisions unavailable');
  if (!result.data.length) return [];
  const itemIds = [...new Set(result.data.map((revision) => revision.item_id))];
  const itemResult = await client.from('site_content_items')
    .select('id,kind,slug,route_path,archived_at').in('id', itemIds);
  if (itemResult.error || !Array.isArray(itemResult.data)) throw new Error('Site content items unavailable');
  const items = new Map(itemResult.data.map((item) => [item.id, item]));
  return result.data.flatMap((revision) => {
    const item = items.get(revision.item_id);
    return item && item.kind === revision.kind ? [{ ...revision, item }] : [];
  });
}

export async function getSiteContentRevision(client: AuthClient, id: string) {
  if (!isSiteContentUuid(id)) return null;
  const revisionResult = await client.from('site_content_revisions')
    .select('id,item_id,kind,locale,title,body,summary,seo_title,seo_description,created_at')
    .eq('id', id).maybeSingle();
  if (revisionResult.error) throw revisionResult.error;
  if (!revisionResult.data) return null;
  const itemResult = await client.from('site_content_items')
    .select('id,kind,slug,route_path,archived_at').eq('id', revisionResult.data.item_id).maybeSingle();
  if (itemResult.error) throw itemResult.error;
  if (!itemResult.data || itemResult.data.kind !== revisionResult.data.kind) return null;
  const [approval, publication, review] = await Promise.all([
    client.from('site_content_approvals').select('revision_id').eq('revision_id', id).maybeSingle(),
    client.from('site_content_publications').select('revision_id')
      .eq('item_id', itemResult.data.id).eq('locale', revisionResult.data.locale).maybeSingle(),
    client.from('site_content_reviews').select('revision_id').eq('revision_id', id).maybeSingle(),
  ]);
  if (approval.error) throw approval.error;
  if (publication.error) throw publication.error;
  if (review.error) throw review.error;
  return {
    revision: revisionResult.data,
    item: itemResult.data,
    state: {
      approved: approval.data?.revision_id === id,
      current: publication.data?.revision_id ?? null,
      reviewed: review.data?.revision_id === id,
    },
  };
}

export async function createSiteContentDraft(
  client: AuthClient,
  draft: NonNullable<ReturnType<typeof parseSiteContentDraft>>,
) {
  if (!draft.slug) return null;
  const itemId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const result = draft.kind === 'setting'
    ? await client.rpc('create_site_content_draft', {
        p_item_id: itemId,
        p_revision_id: revisionId,
        p_kind: draft.kind,
        p_slug: draft.slug,
        p_locale: draft.locale,
        p_title: draft.title,
        p_body: draft.body,
        p_summary: draft.summary,
        p_seo_title: draft.seo_title,
        p_seo_description: draft.seo_description,
      })
    : !draft.route_path
      ? null
      : await client.rpc('create_routed_site_content_draft', {
    p_item_id: itemId,
    p_revision_id: revisionId,
    p_kind: draft.kind,
    p_slug: draft.slug,
    p_route_path: draft.route_path,
    p_locale: draft.locale,
    p_title: draft.title,
    p_body: draft.body,
    p_summary: draft.summary,
    p_seo_title: draft.seo_title,
    p_seo_description: draft.seo_description,
  });
  if (!result) return null;
  if (result.error) throw result.error;
  return revisionId;
}

export async function transitionSiteContent(
  client: AuthClient,
  action: 'review' | 'approve' | 'publish' | 'unpublish',
  input: NonNullable<ReturnType<typeof parseSiteContentTransition>>,
) {
  const detail = await getSiteContentRevision(client, input.revision);
  if (!detail || !detail.item.route_path || detail.item.kind === 'setting') return false;
  if (action === 'review') {
    if (detail.revision.locale !== 'ar') return false;
    const result = await client.rpc('review_site_content_revision', { p_revision_id: input.revision });
    if (result.error) throw result.error;
  } else if (action === 'approve') {
    const result = await client.rpc('approve_site_content_revision', { p_revision_id: input.revision });
    if (result.error) throw result.error;
  } else if (action === 'publish') {
    const result = await client.rpc('publish_site_content_revision', {
      p_revision_id: input.revision,
      p_expected_revision_id: input.expected,
    });
    if (result.error) throw result.error;
  } else {
    if (!input.expected) return false;
    const result = await client.rpc('unpublish_site_content', {
      p_item_id: detail.item.id,
      p_locale: detail.revision.locale,
      p_expected_revision_id: input.expected,
    });
    if (result.error) throw result.error;
  }
  return true;
}

export async function reviseSiteContentDraft(
  client: AuthClient,
  draft: NonNullable<ReturnType<typeof parseSiteContentDraft>>,
) {
  if (!draft.revision) return null;
  const revisionId = crypto.randomUUID();
  const result = await client.rpc('revise_site_content_draft', {
    p_source_revision_id: draft.revision,
    p_revision_id: revisionId,
    p_expected_kind: draft.kind,
    p_locale: draft.locale,
    p_title: draft.title,
    p_body: draft.body,
    p_summary: draft.summary,
    p_seo_title: draft.seo_title,
    p_seo_description: draft.seo_description,
  });
  if (result.error) throw result.error;
  return revisionId;
}

export async function archiveSiteContent(
  client: AuthClient,
  input: NonNullable<ReturnType<typeof parseSiteContentArchive>>,
) {
  const result = await client.rpc('set_site_content_archived', {
    p_item_id: input.item_id,
    p_expected_archived: input.expected_archived,
    p_archived: input.archived,
  });
  if (result.error) throw result.error;
  return true;
}
