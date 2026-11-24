import { createClient } from '@supabase/supabase-js';
import type { Language } from '../../i18n/config.ts';
import type { PropertyAvailability, PropertyTransaction } from '../../types/content.ts';

declare const process: { env: Record<string, string | undefined> };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const idPattern = new RegExp(`^${UUID}$`);
const pathPattern = new RegExp(`^([a-z0-9]+(?:-[a-z0-9]+)*)-(${UUID})$`);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const columns = 'id,kind,slug,locale,revision_id,published_at,title,body,area_name,property_type,transaction_type,availability,price_bhd,bedrooms,bathrooms,size_square_meters,location_name';
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
}

export interface Filters {
  page: number;
  transaction?: PropertyTransaction;
  bedrooms?: number;
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
  const allowed = new Set(['page', 'transaction', 'bedrooms']);
  for (const [key] of params) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) return null;
  }
  const page = params.get('page') ?? '1';
  const transaction = params.get('transaction') ?? '';
  const bedrooms = params.get('bedrooms') ?? '';
  if (!/^[1-9]\d?$/.test(page) || Number(page) > MAX_PAGE) return null;
  if (transaction && transaction !== 'sale' && transaction !== 'rent') return null;
  if (bedrooms && !/^(?:0|[1-9]|10)$/.test(bedrooms)) return null;
  return {
    page: Number(page),
    ...(transaction ? { transaction: transaction as PropertyTransaction } : {}),
    ...(bedrooms ? { bedrooms: Number(bedrooms) } : {}),
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
  };
}

export async function listProperties(language: Language, filters: Filters) {
  let query = client().from('published_content').select(columns)
    .eq('kind', 'property').eq('locale', language).in('availability', ['available', 'reserved']);
  if (filters.transaction) query = query.eq('transaction_type', filters.transaction);
  if (filters.bedrooms !== undefined) query = query.gte('bedrooms', filters.bedrooms);
  const start = (filters.page - 1) * PAGE_SIZE;
  const { data, error } = await query.order('published_at', { ascending: false })
    .order('id', { ascending: true }).range(start, start + PAGE_SIZE);
  if (error || !data || !Array.isArray(data)) throw new Error('Public backend unavailable');
  const properties = data.map((row) => propertyFromRow(row, language));
  if (properties.length > PAGE_SIZE + 1 || properties.some((property) =>
    !['available', 'reserved'].includes(property.availability) ||
    (filters.transaction && property.transaction !== filters.transaction) ||
    (filters.bedrooms !== undefined && (property.bedrooms === undefined || property.bedrooms < filters.bedrooms)))) {
    throw new Error('Invalid public property');
  }
  return { properties: properties.slice(0, PAGE_SIZE), hasNext: properties.length > PAGE_SIZE && filters.page < MAX_PAGE };
}

export async function getProperty(language: Language, path: { id: string; slug: string }): Promise<PublicProperty | null> {
  const { data, error } = await client().from('published_content').select(columns)
    .eq('kind', 'property').eq('locale', language).eq('id', path.id).eq('slug', path.slug).maybeSingle();
  if (error) throw new Error('Public backend unavailable');
  if (!data) return null;
  const property = propertyFromRow(data, language);
  if (property.id !== path.id || property.slug !== path.slug) throw new Error('Invalid public property');
  return property;
}
