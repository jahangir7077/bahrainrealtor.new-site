import type { AuthClient } from '../auth/session.ts';
import { one } from '../auth/security.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string | null): value is string => !!value && uuidPattern.test(value);

function text(form: URLSearchParams, name: string, max: number, required = false): string | null | undefined {
  const values = form.getAll(name);
  if (values.length !== 1 || values[0].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(values[0])) return undefined;
  const value = values[0].trim();
  if (required && !value) return undefined;
  return value || null;
}

export function parseDraft(form: URLSearchParams) {
  const allowed = new Set(['action', 'revision', 'locale', 'title', 'body', 'summary', 'area_name', 'property_type', 'seo_title', 'seo_description']);
  if ([...form.keys()].some((key) => !allowed.has(key))) return null;
  const revision = one(form, 'revision', 36);
  const locale = one(form, 'locale', 2);
  const title = text(form, 'title', 200, true);
  const body = text(form, 'body', 4000, true);
  const summary = text(form, 'summary', 500);
  const area_name = text(form, 'area_name', 200, true);
  const property_type = text(form, 'property_type', 200, true);
  const seo_title = text(form, 'seo_title', 200);
  const seo_description = text(form, 'seo_description', 500);
  if (!isUuid(revision) || (locale !== 'en' && locale !== 'ar') ||
      [title, body, summary, area_name, property_type, seo_title, seo_description].some((value) => value === undefined)) return null;
  return { revision, locale, title, body, summary, area_name, property_type, seo_title, seo_description };
}

export function parseTransition(form: URLSearchParams, action: 'approve' | 'publish') {
  const allowed = new Set(action === 'publish' ? ['action', 'revision', 'confirm', 'expected'] : ['action', 'revision', 'confirm']);
  if ([...form.keys()].some((key) => !allowed.has(key)) || one(form, 'confirm', 3) !== 'yes') return null;
  const revision = one(form, 'revision', 36);
  if (!isUuid(revision)) return null;
  if (action === 'approve') return { revision, expected: null };
  const expected = one(form, 'expected', 36);
  if (expected !== 'none' && !isUuid(expected)) return null;
  return { revision, expected: expected === 'none' ? null : expected };
}

export function parseLifecycleTransition(
  form: URLSearchParams,
  action: 'unpublish' | 'archive' | 'unarchive',
) {
  const allowed = new Set(['action', 'item', 'revision', 'locale', 'confirm']);
  if ([...form.keys()].some((key) => !allowed.has(key)) || one(form, 'confirm', 3) !== 'yes') return null;
  const item = one(form, 'item', 36);
  const revision = one(form, 'revision', 36);
  const locale = one(form, 'locale', 2);
  if (!isUuid(item) || !isUuid(revision) || (action === 'unpublish' && locale !== 'en' && locale !== 'ar') ||
      (action !== 'unpublish' && form.has('locale'))) return null;
  return { item, revision, ...(action === 'unpublish' ? { locale } : {}) };
}

function decimal(form: URLSearchParams, name: string, integerDigits: number, decimals: number, positive = false): string | null | undefined {
  const value = text(form, name, integerDigits + decimals + 1);
  if (value === undefined || value === null) return value;
  const pattern = new RegExp(`^(?:0|[1-9][0-9]{0,${integerDigits - 1}})(?:\\.[0-9]{1,${decimals}})?$`);
  if (!pattern.test(value) || (positive && Number(value) <= 0)) return undefined;
  return value;
}

function count(form: URLSearchParams, name: string): number | null | undefined {
  const value = text(form, name, 5);
  if (value === undefined || value === null) return value;
  if (!/^(?:0|[1-9][0-9]{0,4})$/.test(value) || Number(value) > 10000) return undefined;
  return Number(value);
}

export function parseNewDraft(form: URLSearchParams) {
  const allowed = new Set(['action', 'slug', 'locale', 'transaction_type', 'availability', 'price_bhd', 'bedrooms', 'bathrooms', 'size_square_meters', 'location_name', 'title', 'body', 'area_name', 'property_type', 'seo_title', 'seo_description']);
  if ([...form.keys()].some((key) => !allowed.has(key))) return null;
  const slug = one(form, 'slug', 100);
  const locale = one(form, 'locale', 2);
  const transaction_type = one(form, 'transaction_type', 4);
  const availability = one(form, 'availability', 11);
  const price_bhd = decimal(form, 'price_bhd', 11, 3);
  const bedrooms = count(form, 'bedrooms');
  const bathrooms = count(form, 'bathrooms');
  const size_square_meters = decimal(form, 'size_square_meters', 10, 2, true);
  const location_name = text(form, 'location_name', 200, true);
  const title = text(form, 'title', 200, true);
  const body = text(form, 'body', 4000, true);
  const area_name = text(form, 'area_name', 200, true);
  const property_type = text(form, 'property_type', 200, true);
  const seo_title = text(form, 'seo_title', 200);
  const seo_description = text(form, 'seo_description', 500);
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      (locale !== 'en' && locale !== 'ar') ||
      (transaction_type !== 'sale' && transaction_type !== 'rent') ||
      !['available', 'reserved', 'sold', 'rented', 'unavailable'].includes(availability ?? '') ||
      [price_bhd, bedrooms, bathrooms, size_square_meters, location_name, title, body, area_name, property_type, seo_title, seo_description].some((value) => value === undefined)) return null;
  return { slug, locale, transaction_type, availability, price_bhd, bedrooms, bathrooms, size_square_meters, location_name, title, body, area_name, property_type, seo_title, seo_description };
}

export function parseFactsDraft(form: URLSearchParams) {
  const allowed = new Set(['action', 'revision', 'transaction_type', 'availability', 'price_bhd', 'bedrooms', 'bathrooms', 'size_square_meters', 'location_name', 'confirm']);
  if ([...form.keys()].some((key) => !allowed.has(key)) || one(form, 'confirm', 3) !== 'yes') return null;
  const revision = one(form, 'revision', 36);
  const transaction_type = one(form, 'transaction_type', 4);
  const availability = one(form, 'availability', 11);
  const price_bhd = decimal(form, 'price_bhd', 11, 3);
  const bedrooms = count(form, 'bedrooms');
  const bathrooms = count(form, 'bathrooms');
  const size_square_meters = decimal(form, 'size_square_meters', 10, 2, true);
  const location_name = text(form, 'location_name', 200, true);
  if (!isUuid(revision) || (transaction_type !== 'sale' && transaction_type !== 'rent') ||
      !['available', 'reserved', 'sold', 'rented', 'unavailable'].includes(availability ?? '') ||
      [price_bhd, bedrooms, bathrooms, size_square_meters, location_name].some((value) => value === undefined)) return null;
  return { revision, transaction_type, availability, price_bhd, bedrooms, bathrooms, size_square_meters, location_name };
}

export async function createNewDraft(client: AuthClient, draft: NonNullable<ReturnType<typeof parseNewDraft>>) {
  const itemId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const result = await client.rpc('create_property_draft', {
    p_item_id: itemId, p_property_version_id: versionId, p_revision_id: revisionId,
    p_slug: draft.slug, p_locale: draft.locale, p_transaction_type: draft.transaction_type,
    p_availability: draft.availability, p_price_bhd: draft.price_bhd, p_bedrooms: draft.bedrooms,
    p_bathrooms: draft.bathrooms, p_size_square_meters: draft.size_square_meters,
    p_location_name: draft.location_name, p_title: draft.title, p_body: draft.body,
    p_area_name: draft.area_name, p_property_type: draft.property_type,
    p_seo_title: draft.seo_title, p_seo_description: draft.seo_description,
  });
  if (result.error) throw result.error;
  return revisionId;
}

export async function createFactsDraft(client: AuthClient, facts: NonNullable<ReturnType<typeof parseFactsDraft>>) {
  const source = await getPropertyRevision(client, facts.revision);
  if (!source) return null;
  const propertyVersionId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const result = await client.rpc('create_property_version_draft', {
    p_item_id: source.item.id,
    p_source_revision_id: facts.revision,
    p_property_version_id: propertyVersionId,
    p_revision_id: revisionId,
    p_transaction_type: facts.transaction_type,
    p_availability: facts.availability,
    p_price_bhd: facts.price_bhd,
    p_bedrooms: facts.bedrooms,
    p_bathrooms: facts.bathrooms,
    p_size_square_meters: facts.size_square_meters,
    p_location_name: facts.location_name,
  });
  if (result.error) throw result.error;
  return revisionId;
}

export async function listRevisions(client: AuthClient) {
  const result = await client.from('content_revisions')
    .select('id,item_id,locale,title,created_at,content_items!inner(kind,slug)')
    .eq('content_items.kind', 'property').order('created_at', { ascending: false }).limit(50);
  if (result.error) throw result.error;
  return result.data;
}

export async function getPropertyRevision(client: AuthClient, id: string) {
  if (!isUuid(id)) return null;
  const revision = await client.from('content_revisions')
    .select('id,item_id,locale,property_version_id,title,body,summary,area_name,property_type,seo_title,seo_description,created_at')
    .eq('id', id).maybeSingle();
  if (revision.error) throw revision.error;
  if (!revision.data?.property_version_id) return null;
  const item = await client.from('content_items').select('id,kind,slug')
    .eq('id', revision.data.item_id).eq('kind', 'property').maybeSingle();
  if (item.error) throw item.error;
  if (!item.data) return null;
  const version = await client.from('property_versions')
    .select('id,transaction_type,availability,price_bhd::text,bedrooms,bathrooms,size_square_meters,location_name')
    .eq('id', revision.data.property_version_id).eq('item_id', item.data.id).maybeSingle();
  if (version.error) throw version.error;
  if (!version.data) return null;
  return { revision: revision.data, item: item.data, version: version.data };
}

export async function publicationState(client: AuthClient, itemId: string, locale: string, revisionId: string) {
  const approval = await client.from('revision_approvals').select('revision_id').eq('revision_id', revisionId).maybeSingle();
  if (approval.error) throw approval.error;
  const publication = await client.from('publications').select('revision_id').eq('item_id', itemId).eq('locale', locale).maybeSingle();
  if (publication.error) throw publication.error;
  return { approved: !!approval.data, current: publication.data?.revision_id ?? null };
}

export async function createDraft(client: AuthClient, userId: string, draft: NonNullable<ReturnType<typeof parseDraft>>) {
  const source = await getPropertyRevision(client, draft.revision);
  if (!source) return null;
  const result = await client.from('content_revisions').insert({
    item_id: source.item.id,
    property_version_id: source.version.id,
    locale: draft.locale,
    title: draft.title,
    body: draft.body,
    summary: draft.summary,
    area_name: draft.area_name,
    property_type: draft.property_type,
    seo_title: draft.seo_title,
    seo_description: draft.seo_description,
    created_by: userId,
  }).select('id').single();
  if (result.error) throw result.error;
  if (!isUuid(result.data?.id)) throw new Error('Draft not returned');
  return result.data.id;
}

export async function transition(client: AuthClient, action: 'approve' | 'publish', input: NonNullable<ReturnType<typeof parseTransition>>) {
  if (!await getPropertyRevision(client, input.revision)) return false;
  const result = action === 'approve'
    ? await client.rpc('approve_revision', { p_revision_id: input.revision })
    : await client.rpc('publish_revision_if_current', { p_revision_id: input.revision, p_expected_revision_id: input.expected });
  if (result.error) throw result.error;
  return true;
}

export async function transitionLifecycle(
  client: AuthClient,
  action: 'unpublish' | 'archive' | 'unarchive',
  input: NonNullable<ReturnType<typeof parseLifecycleTransition>>,
) {
  const revision = await getPropertyRevision(client, input.revision);
  if (!revision || revision.item.id !== input.item) return false;
  const result = action === 'unpublish'
    ? await client.rpc('unpublish_content', { p_item_id: input.item, p_locale: input.locale })
    : await client.rpc(action === 'archive' ? 'archive_content' : 'unarchive_content', { p_item_id: input.item });
  if (result.error) throw result.error;
  return true;
}

export async function contentArchived(client: AuthClient, itemId: string) {
  const result = await client.from('content_lifecycle').select('status').eq('item_id', itemId).maybeSingle();
  if (result.error) throw result.error;
  return result.data?.status === 'archived';
}
