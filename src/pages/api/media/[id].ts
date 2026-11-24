import { createClient } from '@supabase/supabase-js';
import { settings } from '../../../server/auth/session.ts';
import { protectedJson } from '../../../server/media/admin.ts';
import { isUuid } from '../../../server/admin-properties/workflow.ts';

export const prerender = false;

export async function GET({ request, params }: { request: Request; params: { id?: string } }) {
  if (request.method !== 'GET' || !isUuid(params.id ?? null)) return protectedJson({ error: 'Media not found.' }, 404);
  const config = settings();
  if (!config) return protectedJson({ error: 'Media delivery unavailable.' }, 503);
  try {
    const publicClient = createClient(config.url, config.key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const media = await publicClient.from('content_media')
      .select('object_path').eq('id', params.id).maybeSingle();
    if (media.error || !media.data) return protectedJson({ error: 'Media not found.' }, 404);
    const signed = await publicClient.storage.from('private-media').createSignedUrl(media.data.object_path, 300, {
      transform: { width: 1600, height: 1200, resize: 'contain', quality: 80 },
    });
    if (signed.error || !signed.data?.signedUrl) return protectedJson({ error: 'Media not found.' }, 404);
    return new Response(null, {
      status: 302,
      headers: {
        Location: signed.data.signedUrl,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return protectedJson({ error: 'Media delivery unavailable.' }, 503);
  }
}
