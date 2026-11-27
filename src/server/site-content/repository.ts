import { createClient } from '@supabase/supabase-js';
import type { Language } from '../../i18n/config.ts';
import { isSiteContentRoute, SITE_CONTENT_ROUTES, siteContentRouteKind } from './routes.ts';

declare const process: { env: Record<string, string | undefined> };

export interface PublishedSiteContent {
  id: string;
  kind: 'area' | 'project' | 'landing';
  slug: string;
  routePath: string;
  revisionId: string;
  publishedAt: string;
  title: string;
  body: string;
  summary?: string;
  seoTitle?: string;
  seoDescription?: string;
  locale: Language;
}

function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || key.startsWith('sb_secret_')) throw new Error('Public backend unavailable');
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
      (parsed.protocol !== 'https:' && !(import.meta.env.DEV && parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)))) {
    throw new Error('Public backend unavailable');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
  });
}

function validate(row: Record<string, unknown>, language: Language): PublishedSiteContent {
  if (row.locale !== language || !['area', 'project', 'landing'].includes(String(row.kind)) ||
      typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) ||
      typeof row.revision_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.revision_id) ||
      typeof row.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) ||
      typeof row.route_path !== 'string' || !isSiteContentRoute(row.route_path) ||
      siteContentRouteKind(row.route_path) !== row.kind ||
      typeof row.published_at !== 'string' || !Number.isFinite(Date.parse(row.published_at)) ||
      typeof row.title !== 'string' || !row.title.trim() ||
      typeof row.body !== 'string' || !row.body.trim() ||
      (row.summary !== null && typeof row.summary !== 'string') ||
      (row.seo_title !== null && typeof row.seo_title !== 'string') ||
      (row.seo_description !== null && typeof row.seo_description !== 'string')) {
    throw new Error('Invalid published site content');
  }
  const expectedSlug = row.route_path.slice(1, -1).replaceAll('/', '-');
  if (row.slug !== expectedSlug) throw new Error('Site content route and slug do not match');
  return {
    id: row.id,
    kind: row.kind as PublishedSiteContent['kind'],
    slug: row.slug,
    routePath: row.route_path,
    revisionId: row.revision_id,
    publishedAt: row.published_at,
    title: row.title,
    body: row.body,
    ...(typeof row.summary === 'string' && row.summary.trim() ? { summary: row.summary } : {}),
    ...(typeof row.seo_title === 'string' && row.seo_title.trim() ? { seoTitle: row.seo_title } : {}),
    ...(typeof row.seo_description === 'string' && row.seo_description.trim()
      ? { seoDescription: row.seo_description }
      : {}),
    locale: language,
  };
}

const columns = 'id,kind,slug,route_path,locale,revision_id,published_at,title,body,summary,seo_title,seo_description';

export async function getPublishedSiteContent(
  language: Language,
  routePath: string,
): Promise<PublishedSiteContent | null> {
  if (!isSiteContentRoute(routePath)) return null;
  const { data, error } = await publicClient().from('published_site_content')
    .select(columns).eq('locale', language).eq('route_path', routePath).maybeSingle();
  if (error) throw new Error('Published site content unavailable');
  return data ? validate(data, language) : null;
}

export async function listPublishedSiteContent(language: Language): Promise<PublishedSiteContent[]> {
  const { data, error } = await publicClient().from('published_site_content')
    .select(columns).eq('locale', language).order('route_path').limit(SITE_CONTENT_ROUTES.length + 1);
  if (error || !Array.isArray(data) || data.length > SITE_CONTENT_ROUTES.length) {
    throw new Error('Published site content unavailable');
  }
  return data.map((row) => validate(row, language));
}

export async function listPublishedSiteContentPaths(): Promise<{ path: string; lastModified: string }[]> {
  const entries: { path: string; lastModified: string }[] = [];
  for (const language of ['en', 'ar'] as const) {
    for (const content of await listPublishedSiteContent(language)) {
      entries.push({
        path: `${language === 'ar' ? '/ar' : ''}${content.routePath}`,
        lastModified: content.publishedAt,
      });
    }
  }
  return entries;
}
