import { createClient } from '@supabase/supabase-js';
import { settings } from '../../../server/auth/session.ts';
import { MEDIA_BUCKET, protectedJson } from '../../../server/media/admin.ts';
import { MAX_OPTIMIZED_MEDIA_BYTES, optimizeImage } from '../../../server/media/optimize.ts';
import { createServiceClient } from '../../../server/enquiries/backend.ts';
import { getOrCreateOptimizedImage } from '../../../server/media/cache.ts';
import { isUuid } from '../../../server/admin-properties/workflow.ts';

export const prerender = false;

export async function GET({ request, params }: { request: Request; params: { id?: string } }) {
  const mediaId = params.id;
  if (request.method !== 'GET' || !mediaId || !isUuid(mediaId)) {
    return protectedJson({ error: 'Media not found.' }, 404);
  }
  const config = settings();
  if (!config) return protectedJson({ error: 'Media delivery unavailable.' }, 503);

  try {
    const publicClient = createClient(config.url, config.key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
    });
    const visible = await publicClient.from('published_content_media')
      .select('id').eq('id', mediaId).maybeSingle();
    if (visible.error || !visible.data) return protectedJson({ error: 'Media not found.' }, 404);

    const bytes = await getOrCreateOptimizedImage(mediaId, async () => {
      const serviceClient = createServiceClient();
      if (!serviceClient) throw new Error('Media delivery is not configured');
      const metadata = await serviceClient.from('content_media')
        .select('object_path').eq('id', mediaId).maybeSingle();
      if (metadata.error || !metadata.data) throw new Error('Media not found');
      const original = await serviceClient.storage.from(MEDIA_BUCKET).download(metadata.data.object_path);
      if (original.error || original.data.size < 1 || original.data.size > MAX_OPTIMIZED_MEDIA_BYTES) {
        throw new Error('Media not found');
      }
      const optimized = await optimizeImage(new Uint8Array(await original.data.arrayBuffer()));
      return new Uint8Array(optimized.bytes);
    });
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=60',
        'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      },
    });
  } catch {
    return protectedJson({ error: 'Media delivery unavailable.' }, 503);
  }
}
