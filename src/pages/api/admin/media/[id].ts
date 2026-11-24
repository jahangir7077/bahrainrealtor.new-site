import { MEDIA_BUCKET, mediaAdmin, mediaMutationAllowed, protectedJson } from '../../../../server/media/admin.ts';
import { isUuid } from '../../../../server/admin-properties/workflow.ts';

export const prerender = false;

export async function PATCH({ request, cookies, params }: { request: Request; cookies: import('astro').AstroCookies; params: { id?: string } }) {
  try {
    const auth = await mediaAdmin(request, cookies);
    if (!auth.config) return protectedJson({ error: 'Media administration unavailable.' }, 503);
    if (!mediaMutationAllowed(request, auth.config.origin)) return protectedJson({ error: 'Request could not be completed.' }, 403);
    if (!auth.client) return protectedJson({ error: 'Not authorized.' }, 403);
    if (!isUuid(params.id ?? null)) return protectedJson({ error: 'Invalid media ID.' }, 400);
    const length = Number(request.headers.get('content-length') ?? '0');
    if (!Number.isSafeInteger(length) || length < 1 || length > 2_048) return protectedJson({ error: 'Invalid metadata.' }, 400);
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return protectedJson({ error: 'Invalid metadata.' }, 400);
    const data = value as Record<string, unknown>;
    if (Object.keys(data).sort().join(',') !== 'alt_text,is_cover,position' ||
        typeof data.alt_text !== 'string' || !data.alt_text.trim() || data.alt_text.length > 500 ||
        /[\u0000-\u001f\u007f]/.test(data.alt_text) ||
        typeof data.is_cover !== 'boolean' || !Number.isInteger(data.position) ||
        (data.position as number) < 0 || (data.position as number) > 999) {
      return protectedJson({ error: 'Alt text, image order, or cover selection is invalid.' }, 400);
    }
    const result = await auth.client.rpc('set_content_media_metadata', {
      p_media_id: params.id,
      p_alt_text: data.alt_text.trim(),
      p_position: data.position,
      p_is_cover: data.is_cover,
    });
    if (result.error) throw result.error;
    return protectedJson({ updated: true });
  } catch {
    return protectedJson({ error: 'Media metadata could not be updated.' }, 400);
  }
}

export async function DELETE({ request, cookies, params }: { request: Request; cookies: import('astro').AstroCookies; params: { id?: string } }) {
  try {
    const auth = await mediaAdmin(request, cookies);
    if (!auth.config) return protectedJson({ error: 'Media administration unavailable.' }, 503);
    if (!mediaMutationAllowed(request, auth.config.origin)) return protectedJson({ error: 'Request could not be completed.' }, 403);
    if (!auth.client) return protectedJson({ error: 'Not authorized.' }, 403);
    if (!isUuid(params.id ?? null)) return protectedJson({ error: 'Invalid media ID.' }, 400);
    const media = await auth.client.from('content_media').select('id,object_path').eq('id', params.id).maybeSingle();
    if (media.error || !media.data) return protectedJson({ error: 'Media not found.' }, 404);
    const removed = await auth.client.storage.from(MEDIA_BUCKET).remove([media.data.object_path]);
    if (removed.error) throw removed.error;
    const deleted = await auth.client.from('content_media').delete().eq('id', params.id).select('id').maybeSingle();
    if (deleted.error || !deleted.data) throw deleted.error ?? new Error('Media metadata not removed');
    return protectedJson({ deleted: true });
  } catch {
    return protectedJson({ error: 'Media could not be deleted.' }, 400);
  }
}
