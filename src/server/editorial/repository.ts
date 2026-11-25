import { createClient } from '@supabase/supabase-js';
import type { Language } from '../../i18n/config.ts';
import type { ArticleRecord, FaqRecord } from '../../types/content.ts';

declare const process: { env: Record<string, string | undefined> };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fields = 'id,kind,slug,locale,revision_id,published_at,title,body,summary,author_name,seo_title,seo_description,category_slug,category_name';

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

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function rowsFor(language: Language, kind: 'article' | 'faq') {
  return publicClient().from('published_editorial').select(fields)
    .eq('kind', kind).eq('locale', language)
    .order('published_at', { ascending: false }).order('id', { ascending: true }).limit(100);
}

function validate(row: Record<string, unknown>, kind: 'article' | 'faq', language: Language) {
  const validOptional = (value: unknown) => value === null || typeof value === 'string';
  if (row.kind !== kind || row.locale !== language || !text(row.id) || !uuidPattern.test(row.id) ||
      !text(row.revision_id) || !uuidPattern.test(row.revision_id) || !text(row.slug) ||
      !slugPattern.test(row.slug) || !text(row.published_at) || Number.isNaN(Date.parse(row.published_at)) ||
      !text(row.title) || !text(row.body) || !text(row.category_slug) || !slugPattern.test(row.category_slug) ||
      !text(row.category_name) || !validOptional(row.summary) || !validOptional(row.author_name) ||
      !validOptional(row.seo_title) || !validOptional(row.seo_description) ||
      (kind === 'article' && (!text(row.summary) || !text(row.author_name))) ||
      (kind === 'faq' && (row.summary !== null || row.author_name !== null))) {
    throw new Error('Invalid public editorial content');
  }
  return row;
}

function publication(row: Record<string, unknown>, language: Language, detail = false) {
  const routePath = detail
    ? `${language === 'ar' ? '/ar' : ''}/guides/${row.slug}/`
    : `${language === 'ar' ? '/ar' : ''}/blog/${row.kind === 'article' ? 'articles' : 'faqs'}/`;
  return {
    status: 'published' as const,
    revisionId: row.revision_id as string,
    publicationApprovedRevisionId: row.revision_id as string,
    publishedRevisionId: row.revision_id as string,
    ...(language === 'ar' ? { humanReviewedRevisionId: row.revision_id as string } : {}),
    routePath,
    canonicalPath: routePath,
    routeExists: true,
    indexable: detail && process.env.SEO_INDEXING_ENABLED === 'true',
    redirected: false,
  };
}

function articleRecord(row: Record<string, unknown>, language: Language, detail = false): ArticleRecord {
  return {
    id: row.id as string,
    slug: row.slug as string,
    authorName: row.author_name as string,
    publishedAt: row.published_at as string,
    content: {
      [language]: {
        title: row.title as string,
        summary: row.summary as string,
        body: row.body as string,
        ...(typeof row.seo_title === 'string' && row.seo_title.trim()
          ? { seoTitle: row.seo_title }
          : {}),
        ...(typeof row.seo_description === 'string' && row.seo_description.trim()
          ? { seoDescription: row.seo_description }
          : {}),
        categoryName: row.category_name as string,
        ...(language === 'ar' ? { humanReviewedRevisionId: row.revision_id as string } : {}),
      },
    },
    publication: { [language]: publication(row, language, detail) },
  };
}

export async function listPublishedArticles(language: Language): Promise<readonly ArticleRecord[]> {
  const { data, error } = await rowsFor(language, 'article');
  if (error || !Array.isArray(data)) throw new Error('Public editorial content unavailable');
  return data.map((untrusted) => {
    const row = validate(untrusted, 'article', language);
    return articleRecord(row, language);
  });
}

export async function getPublishedArticle(language: Language, slug: string): Promise<ArticleRecord | null> {
  if (!slugPattern.test(slug) || slug.length > 160) return null;
  const { data, error } = await rowsFor(language, 'article').eq('slug', slug).maybeSingle();
  if (error) throw new Error('Public editorial content unavailable');
  if (!data) return null;
  return articleRecord(validate(data, 'article', language), language, true);
}

export async function listPublishedEditorialPaths(): Promise<{ path: string; lastModified: string }[]> {
  const paths: { path: string; lastModified: string }[] = [];
  for (const language of ['en', 'ar'] as const) {
    const articles = await listPublishedArticles(language);
    const faqs = await listPublishedFaqs(language);
    if (articles.length === 100 || faqs.length === 100) {
      throw new Error('Published editorial sitemap exceeds configured capacity');
    }
    const articleDates = articles.map((article) => article.publishedAt).filter(
      (date): date is string => Boolean(date && Number.isFinite(Date.parse(date))),
    );
    const faqDates = faqs.map((faq) => faq.publishedAt).filter(
      (date): date is string => Boolean(date && Number.isFinite(Date.parse(date))),
    );
    if (articleDates.length !== articles.length || faqDates.length !== faqs.length) {
      throw new Error('Invalid published editorial date');
    }
    const latestDate = [...articleDates, ...faqDates].reduce<string | undefined>(
      (latest, date) => !latest || Date.parse(date) > Date.parse(latest) ? date : latest,
      undefined,
    );
    const prefix = language === 'ar' ? '/ar' : '';
    if (articles.length) {
      paths.push({
        path: `${prefix}/blog/articles/`,
        lastModified: articleDates.reduce((latest, date) =>
          Date.parse(date) > Date.parse(latest) ? date : latest),
      });
    }
    if (faqs.length) {
      paths.push({
        path: `${prefix}/blog/faqs/`,
        lastModified: faqDates.reduce((latest, date) =>
          Date.parse(date) > Date.parse(latest) ? date : latest),
      });
    }
    if (latestDate) paths.push({ path: `${prefix}/blog/`, lastModified: latestDate });
    for (const article of articles) {
      if (!article.publishedAt) throw new Error('Invalid published article date');
      paths.push({
        path: `${prefix}/guides/${article.slug}/`,
        lastModified: article.publishedAt,
      });
    }
  }
  return paths;
}

export async function listPublishedFaqs(language: Language): Promise<readonly FaqRecord[]> {
  const { data, error } = await rowsFor(language, 'faq');
  if (error || !Array.isArray(data)) throw new Error('Public editorial content unavailable');
  return data.map((untrusted) => {
    const row = validate(untrusted, 'faq', language);
    return {
      id: row.id as string,
      publishedAt: row.published_at as string,
      content: {
        [language]: {
          question: row.title as string,
          answer: row.body as string,
          categoryName: row.category_name as string,
          ...(language === 'ar' ? { humanReviewedRevisionId: row.revision_id as string } : {}),
        },
      },
      publication: { [language]: publication(row, language) },
    };
  });
}
