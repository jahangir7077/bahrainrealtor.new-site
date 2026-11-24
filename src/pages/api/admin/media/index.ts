import { MAX_MEDIA_PER_REVISION, MAX_MULTIPART_BYTES, MEDIA_BUCKET, mediaAdmin, mediaMutationAllowed, mediaRows, protectedJson, readBoundedBody, revisionTarget, validRevisionId } from '../../../../server/media/admin.ts';
import { MAX_MEDIA_BYTES, safeObjectKey, validateImage } from '../../../../server/media/validation.ts';
import { isUuid } from '../../../../server/admin-properties/workflow.ts';

export const prerender = false;

export async function GET({ request, cookies }: { request: Request; cookies: import('astro').AstroCookies }) {
  try {
    const auth = await mediaAdmin(request, cookies);
    if (!auth.config) return protectedJson({ error: 'Media administration unavailable.' }, 503);
    if (!auth.client) return protectedJson({ error: 'Not authorized.' }, 403);
    const revisions = new URL(request.url).searchParams.getAll('revision');
    if (revisions.length !== 1 || !validRevisionId(revisions[0])) return protectedJson({ error: 'Invalid revision.' }, 400);
    const result = await mediaRows(auth.client, revisions[0]);
    if (result.error) throw result.error;
    return protectedJson({ media: result.data });
  } catch {
    return protectedJson({ error: 'Media administration unavailable.' }, 503);
  }
}

export async function POST({ request, cookies }: { request: Request; cookies: import('astro').AstroCookies }) {
  try {
    const auth = await mediaAdmin(request, cookies);
    if (!auth.config) return protectedJson({ error: 'Media administration unavailable.' }, 503);
    if (!mediaMutationAllowed(request, auth.config.origin)) return protectedJson({ error: 'Request could not be completed.' }, 403);
    if (!auth.client || !auth.user) return protectedJson({ error: 'Not authorized.' }, 403);
    const body = await readBoundedBody(request);
    if (!body || body.byteLength > MAX_MULTIPART_BYTES) return protectedJson({ error: 'Upload is too large.' }, 413);
    const boundedBody = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
    const boundedRequest = new Request(request.url, { method: 'POST', headers: request.headers, body: boundedBody });
    const form = await boundedRequest.formData();
    const keys = [...form.keys()];
    if (keys.some((key) => !['file', 'revision', 'alt_text'].includes(key)) ||
        keys.length !== 3 || new Set(keys).size !== 3) return protectedJson({ error: 'Invalid upload fields.' }, 400);
    const file = form.get('file');
    const revisionId = form.get('revision');
    const altText = form.get('alt_text');
    if (typeof file === 'string' || !(file instanceof File) || typeof revisionId !== 'string' ||
        !isUuid(revisionId) || typeof altText !== 'string' || !altText.trim() || altText.length > 500 ||
        /[\u0000-\u001f\u007f]/.test(altText)) {
      return protectedJson({ error: 'Invalid upload fields.' }, 400);
    }
    if (file.size > MAX_MEDIA_BYTES) return protectedJson({ error: 'Image exceeds the 8 MiB limit.' }, 413);
    const image = await validateImage(file);
    if (!image) return protectedJson({ error: 'Only valid JPEG, PNG, or WebP images within the size and dimension limits are accepted.' }, 415);
    const target = await revisionTarget(auth.client, revisionId);
    if (!target) return protectedJson({ error: 'Revision not found.' }, 404);
    const current = await mediaRows(auth.client, revisionId);
    if (current.error) throw current.error;
    if (current.data.length >= MAX_MEDIA_PER_REVISION) {
      return protectedJson({ error: 'This revision already has the maximum of 20 images.' }, 409);
    }
    const key = safeObjectKey(target.item_id, target.id, image.extension);
    const imageBuffer = image.bytes.buffer.slice(image.bytes.byteOffset, image.bytes.byteOffset + image.bytes.byteLength) as ArrayBuffer;
    const upload = await auth.client.storage.from(MEDIA_BUCKET).upload(key, imageBuffer, {
      contentType: image.type,
      cacheControl: '0',
      upsert: false,
    });
    if (upload.error) throw upload.error;
    const inserted = await auth.client.rpc('create_content_media', {
      p_item_id: target.item_id,
      p_revision_id: target.id,
      p_locale: target.locale,
      p_object_path: key,
      p_mime_type: image.type,
      p_byte_size: file.size,
      p_width: image.width,
      p_height: image.height,
      p_alt_text: altText.trim(),
    });
    if (inserted.error) {
      await auth.client.storage.from(MEDIA_BUCKET).remove([key]);
      if (inserted.error.message?.includes('Revision image limit reached')) {
        return protectedJson({ error: 'This revision already has the maximum of 20 images.' }, 409);
      }
      throw inserted.error;
    }
    const created = Array.isArray(inserted.data) ? inserted.data[0] : null;
    if (!created || !isUuid(created.id)) {
      await auth.client.storage.from(MEDIA_BUCKET).remove([key]);
      throw new Error('Media metadata not returned');
    }
    return protectedJson({ id: created.id, position: created.created_position, is_cover: created.is_cover }, 201);
  } catch {
    return protectedJson({ error: 'The upload failed. Verify the revision and current media state.' }, 400);
  }
}
