import type { AstroCookies } from 'astro';
import { createAuthClient, membership, mfaState, settings } from '../auth/session.ts';
import type { AuthClient } from '../auth/session.ts';
import { isUuid } from '../admin-properties/workflow.ts';

export const MEDIA_BUCKET = 'private-media';
export const MEDIA_TABLE = 'content_media';
export const MAX_MULTIPART_BYTES = 8 * 1024 * 1024 + 64_000;
export const MAX_MEDIA_PER_REVISION = 20;

export function mediaMutationAllowed(request: Request, origin: string | null) {
  if (!origin || request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const method = request.method.toUpperCase();
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  return (method === 'POST' && contentType === 'multipart/form-data') ||
    (method === 'PATCH' && contentType === 'application/json') ||
    (method === 'DELETE' && contentType === 'application/json');
}

export async function mediaAdmin(request: Request, cookies: AstroCookies) {
  const config = settings();
  if (!config) return { config: null, client: null, user: null };
  const client = createAuthClient(request, cookies, config);
  const user = await membership(client);
  if (!user) return { config, client: null, user: null };
  const state = await mfaState(client);
  if (!state?.authorized) return { config, client: null, user: null };
  return { config, client, user };
}

export function validRevisionId(value: string | null): value is string {
  return isUuid(value);
}

export async function revisionTarget(client: AuthClient, revisionId: string) {
  const revision = await client.from('content_revisions')
    .select('id,item_id,locale').eq('id', revisionId).maybeSingle();
  if (revision.error || !revision.data || (revision.data.locale !== 'en' && revision.data.locale !== 'ar')) return null;
  const item = await client.from('content_items').select('id,kind').eq('id', revision.data.item_id).maybeSingle();
  if (item.error || !item.data || !['property', 'article', 'faq'].includes(item.data.kind)) return null;
  return { ...revision.data, kind: item.data.kind };
}

export function protectedJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    },
  });
}

export async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_MULTIPART_BYTES)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function mediaRows(client: AuthClient, revisionId: string) {
  return client.from(MEDIA_TABLE)
    .select('id,revision_id,locale,alt_text,position,is_cover,mime_type,byte_size,width,height,created_at')
    .eq('revision_id', revisionId).order('position', { ascending: true }).limit(100);
}

export async function listMediaRevisions(client: AuthClient) {
  const result = await client.from('content_revisions')
    .select('id,item_id,locale,title,created_at,content_items!inner(kind,slug)')
    .in('content_items.kind', ['property', 'article', 'faq'])
    .order('created_at', { ascending: false }).limit(200);
  if (result.error) throw result.error;
  return result.data.map((revision) => {
    const relation = revision.content_items as unknown as { kind?: string } | { kind?: string }[] | null;
    const content = Array.isArray(relation) ? relation[0] : relation;
    return { ...revision, content_kind: content?.kind ?? 'content' };
  });
}
