import { createClient } from '@supabase/supabase-js';
import type { Language } from '../../i18n/config.ts';
import type { PropertyAvailability, PropertyTransaction } from '../../types/content.ts';

declare const process: { env: Record<string, string | undefined> };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const idPattern = new RegExp(`^${UUID}$`);
const pathPattern = new RegExp(`^([a-z0-9]+(?:-[a-z0-9]+)*)-(${UUID})$`);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const columns = 'id,kind,slug,locale,revision_id,published_at,title,body,area_name,property_type,transaction_type,availability,price_bhd,price_bhd_numeric,bedrooms,bathrooms,size_square_meters,location_name';
export const PAGE_SIZE = 20;
export const MAX_PAGE = 50;

export interface PublicProperty {
  id: string;
  slug: string;
  title: string;
  body: string;
  areaName: string;
  propertyType: string;
  transaction: PropertyTransaction;
  availability: PropertyAvailability;
  priceBhd?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSquareMeters?: number;
  locationName: string;
  images: PublicMediaImage[];
}

export interface PublicMediaImage {
  id: string;
  altText: string;
  position: number;
  cover: boolean;
  mimeType: string;
  width: number;
  height: number;
}

export interface Filters {
  page: number;
  transaction?: PropertyTransaction;
  bedrooms?: number;
  query?: string;
  location?: string;
  propertyType?: string;
  minimumPrice?: string;
  maximumPrice?: string;
  sort: 'newest' | 'price_asc' | 'price_desc' | 'bedrooms';
}

export function parsePropertyPath(segment: string | undefined): { slug: string; id: string } | null {
  if (!segment || segment.length > 200) return null;
  const match = pathPattern.exec(segment);
  return match ? { slug: match[1], id: match[2] } : null;
}

export function propertyPath(property: Pick<PublicProperty, 'slug' | 'id'>, language: Language): string {
  return `${language === 'ar' ? '/ar' : ''}/properties/${property.slug}-${property.id}/`;
}

export function parseFilters(params: URLSearchParams): Filters | null {
  const allowed = new Set(['page', 'transaction', 'bedrooms', 'q', 'location', 'propertyType', 'minimumPrice', 'maximumPrice', 'sort']);
  for (const [key] of params) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) return null;
  }
  const page = params.get('page') ?? '1';
  const transaction = params.get('transaction') ?? '';
  const bedrooms = params.get('bedrooms') ?? '';
  const query = params.get('q')?.trim() ?? '';
  const location = params.get('location')?.trim() ?? '';
  const propertyType = params.get('propertyType')?.trim() ?? '';
  const minimumPrice = params.get('minimumPrice') ?? '';
  const maximumPrice = params.get('maximumPrice') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const safeText = (value: string, maxLength: number) =>
    value.length <= maxLength && /^[\p{L}\p{M}\p{N} -]*$/u.test(value);
  const validPrice = (value: string) => /^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/.test(value);
  if (!/^[1-9]\d?$/.test(page) || Number(page) > MAX_PAGE) return null;
  if (transaction && transaction !== 'sale' && transaction !== 'rent') return null;
  if (bedrooms && !/^(?:0|[1-9]|10)$/.test(bedrooms)) return null;
  if ((query && !safeText(query, 80)) || (location && !safeText(location, 100)) ||
      (propertyType && !safeText(propertyType, 100))) return null;
  if ((minimumPrice && !validPrice(minimumPrice)) || (maximumPrice && !validPrice(maximumPrice))) return null;
  if (minimumPrice && maximumPrice && Number(minimumPrice) > Number(maximumPrice)) return null;
  if (!['newest', 'price_asc', 'price_desc', 'bedrooms'].includes(sort)) return null;
  return {
    page: Number(page),
    ...(transaction ? { transaction: transaction as PropertyTransaction } : {}),
    ...(bedrooms ? { bedrooms: Number(bedrooms) } : {}),
    ...(query ? { query } : {}),
    ...(location ? { location } : {}),
    ...(propertyType ? { propertyType } : {}),
    ...(minimumPrice ? { minimumPrice } : {}),
    ...(maximumPrice ? { maximumPrice } : {}),
    sort: sort as Filters['sort'],
  };
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || key.startsWith('sb_secret_')) throw new Error('Public backend unavailable');
  // Legacy public anon JWTs and modern publishable keys are supported, never service-role keys.
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error();
    } catch {
      throw new Error('Public backend unavailable');
    }
  }
  const parsed = new URL(url);
  if (parsed.username || parsed.password || parsed.search || parsed.hash ||
      (parsed.protocol !== 'https:' && !(import.meta.env.DEV && parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)))) {
    throw new Error('Public backend unavailable');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
  });
}

function propertyFromRow(row: Record<string, unknown>, language: Language): PublicProperty {
  const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const optionalNumber = (value: unknown) => value === null || number(value);
  const validPrice = row.price_bhd === null ||
    (typeof row.price_bhd === 'string' && /^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/.test(row.price_bhd));
  if (row.kind !== 'property' || row.locale !== language || !text(row.id) || !idPattern.test(row.id) ||
      !text(row.slug) || row.slug.length > 163 || !slugPattern.test(row.slug) ||
      !text(row.revision_id) || !idPattern.test(row.revision_id) || !text(row.published_at) ||
      Number.isNaN(Date.parse(row.published_at)) ||
      !text(row.title) || !text(row.body) || !text(row.area_name) || !text(row.property_type) ||
      !text(row.location_name) || !['sale', 'rent'].includes(String(row.transaction_type)) ||
      !['available', 'reserved', 'sold', 'rented', 'unavailable'].includes(String(row.availability)) ||
      !validPrice || !optionalNumber(row.bedrooms) || !optionalNumber(row.bathrooms) ||
      !optionalNumber(row.size_square_meters) ||
      (row.bedrooms !== null && !Number.isInteger(row.bedrooms)) ||
      (row.bathrooms !== null && !Number.isInteger(row.bathrooms))) {
    throw new Error('Invalid public property');
  }
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    body: row.body as string,
    areaName: row.area_name as string,
    propertyType: row.property_type as string,
    transaction: row.transaction_type as PropertyTransaction,
    availability: row.availability as PropertyAvailability,
    ...(row.price_bhd !== null ? { priceBhd: row.price_bhd as string } : {}),
    ...(row.bedrooms !== null ? { bedrooms: row.bedrooms as number } : {}),
    ...(row.bathrooms !== null ? { bathrooms: row.bathrooms as number } : {}),
    ...(row.size_square_meters !== null ? { sizeSquareMeters: row.size_square_meters as number } : {}),
    locationName: row.location_name as string,
    images: [],
  };
}

async function publicImages(revisionIds: string[], language: Language, coverOnly: boolean): Promise<Map<string, PublicMediaImage[]>> {
  const result = new Map<string, PublicMediaImage[]>();
  if (!revisionIds.length) return result;
  const maximum = revisionIds.length * (coverOnly ? 1 : 20);
  let query = client().from('published_content_media')
    .select('id,revision_id,locale,alt_text,position,is_cover,mime_type,width,height')
    .eq('locale', language).in('revision_id', revisionIds);
  if (coverOnly) query = query.eq('is_cover', true);
  const { data, error } = await query.order('position', { ascending: true }).limit(maximum);
  if (error || !Array.isArray(data) || data.length > maximum) throw new Error('Public media unavailable');
  const allowedRevisions = new Set(revisionIds);
  for (const row of data) {
    if (typeof row.id !== 'string' || !idPattern.test(row.id) ||
        typeof row.revision_id !== 'string' || !allowedRevisions.has(row.revision_id) || row.locale !== language ||
        typeof row.alt_text !== 'string' || !row.alt_text.trim() || row.alt_text.length > 500 ||
        !Number.isInteger(row.position) || row.position < 0 || row.position > 999 ||
        typeof row.is_cover !== 'boolean' || !['image/jpeg', 'image/png', 'image/webp'].includes(String(row.mime_type)) ||
        !Number.isInteger(row.width) || row.width < 1 || row.width > 8000 ||
        !Number.isInteger(row.height) || row.height < 1 || row.height > 8000) {
      throw new Error('Invalid public media');
    }
    const images = result.get(row.revision_id) ?? [];
    if (images.length >= (coverOnly ? 1 : 20)) throw new Error('Too many public images');
    images.push({
      id: row.id,
      altText: row.alt_text,
      position: row.position,
      cover: row.is_cover,
      mimeType: row.mime_type as string,
      width: row.width as number,
      height: row.height as number,
    });
    result.set(row.revision_id, images);
  }
  return result;
}

function comparePrices(left: string, right: string): number {
  const [leftWhole, leftFraction = ''] = left.split('.');
  const [rightWhole, rightFraction = ''] = right.split('.');
  const normalizedLeft = leftWhole.replace(/^0+(?=\d)/, '');
  const normalizedRight = rightWhole.replace(/^0+(?=\d)/, '');
  if (normalizedLeft.length !== normalizedRight.length) return normalizedLeft.length - normalizedRight.length;
  if (normalizedLeft !== normalizedRight) return normalizedLeft < normalizedRight ? -1 : 1;
  const fractionOrder = leftFraction.padEnd(3, '0').localeCompare(rightFraction.padEnd(3, '0'));
  return Math.sign(fractionOrder);
}

export async function listProperties(language: Language, filters: Filters) {
  let query = client().from('published_content').select(columns)
    .eq('kind', 'property').eq('locale', language).in('availability', ['available', 'reserved']);
  if (filters.transaction) query = query.eq('transaction_type', filters.transaction);
  if (filters.bedrooms !== undefined) query = query.gte('bedrooms', filters.bedrooms);
  if (filters.query) {
    const pattern = `%${filters.query}%`;
    query = query.or(`title.ilike.${pattern},area_name.ilike.${pattern},location_name.ilike.${pattern}`);
  }
  if (filters.location) query = query.ilike('location_name', `%${filters.location}%`);
  if (filters.propertyType) query = query.ilike('property_type', `%${filters.propertyType}%`);
  if (filters.minimumPrice) query = query.gte('price_bhd_numeric', filters.minimumPrice);
  if (filters.maximumPrice) query = query.lte('price_bhd_numeric', filters.maximumPrice);
  const start = (filters.page - 1) * PAGE_SIZE;
  if (filters.sort === 'price_asc') query = query.order('price_bhd_numeric', { ascending: true, nullsFirst: false });
  else if (filters.sort === 'price_desc') query = query.order('price_bhd_numeric', { ascending: false, nullsFirst: false });
  else if (filters.sort === 'bedrooms') query = query.order('bedrooms', { ascending: false, nullsFirst: false });
  else query = query.order('published_at', { ascending: false });
  const { data, error } = await query.order('id', { ascending: true }).range(start, start + PAGE_SIZE);
  if (error || !data || !Array.isArray(data)) throw new Error('Public backend unavailable');
  const properties = data.map((row) => propertyFromRow(row, language));
  if (properties.length > PAGE_SIZE + 1 || properties.some((property) =>
    !['available', 'reserved'].includes(property.availability) ||
    (filters.transaction && property.transaction !== filters.transaction) ||
    (filters.bedrooms !== undefined && (property.bedrooms === undefined || property.bedrooms < filters.bedrooms)) ||
    (filters.minimumPrice && (!property.priceBhd || comparePrices(property.priceBhd, filters.minimumPrice) < 0)) ||
    (filters.maximumPrice && (!property.priceBhd || comparePrices(property.priceBhd, filters.maximumPrice) > 0)) ||
    (filters.location && !property.locationName.toLocaleLowerCase().includes(filters.location.toLocaleLowerCase())) ||
    (filters.propertyType && !property.propertyType.toLocaleLowerCase().includes(filters.propertyType.toLocaleLowerCase())) ||
    (filters.query && ![property.title, property.areaName, property.locationName]
      .some((value) => value.toLocaleLowerCase().includes(filters.query!.toLocaleLowerCase()))))) {
    throw new Error('Invalid public property');
  }
  const visible = properties.slice(0, PAGE_SIZE);
  const images = await publicImages(data.slice(0, PAGE_SIZE).map((row) => row.revision_id as string), language, true);
  visible.forEach((property, index) => {
    property.images = images.get(data[index].revision_id as string) ?? [];
  });
  return { properties: visible, hasNext: properties.length > PAGE_SIZE && filters.page < MAX_PAGE };
}

export async function getProperty(language: Language, path: { id: string; slug: string }): Promise<PublicProperty | null> {
  const { data, error } = await client().from('published_content').select(columns)
    .eq('kind', 'property').eq('locale', language).eq('id', path.id).eq('slug', path.slug).maybeSingle();
  if (error) throw new Error('Public backend unavailable');
  if (!data) return null;
  const property = propertyFromRow(data, language);
  if (property.id !== path.id || property.slug !== path.slug) throw new Error('Invalid public property');
  property.images = (await publicImages([data.revision_id], language, false)).get(data.revision_id) ?? [];
  return property;
}

export async function listRelatedProperties(language: Language, property: PublicProperty): Promise<PublicProperty[]> {
  const { data, error } = await client().from('published_content').select(columns)
    .eq('kind', 'property').eq('locale', language).eq('availability', 'available')
    .eq('area_name', property.areaName).eq('transaction_type', property.transaction)
    .neq('id', property.id).order('published_at', { ascending: false }).limit(3);
  if (error || !data || !Array.isArray(data)) throw new Error('Public backend unavailable');
  const related = data.map((row) => propertyFromRow(row, language));
  if (related.length > 3 || related.some((item) => item.id === property.id ||
      item.availability !== 'available' || item.areaName !== property.areaName ||
      item.transaction !== property.transaction)) throw new Error('Invalid related properties');
  const images = await publicImages(data.map((row) => row.revision_id as string), language, true);
  related.forEach((item, index) => {
    item.images = images.get(data[index].revision_id as string) ?? [];
  });
  return related;
}
