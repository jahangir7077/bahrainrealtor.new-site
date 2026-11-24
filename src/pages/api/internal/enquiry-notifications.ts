import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { createServiceClient } from '../../../server/enquiries/backend.ts';
import {
  deliverEnquiryNotification,
  notificationEndpoint,
  type EnquiryNotification,
} from '../../../server/enquiries/notifications.ts';

declare const process: { env: Record<string, string | undefined> };

export const prerender = false;

function result(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store, max-age=0',
      'x-robots-tag': 'noindex, nofollow',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

function authorized(request: Request, token: string | undefined): boolean {
  if (!token || token.length < 32 || token.length > 512 || /\s/.test(token)) return false;
  const supplied = request.headers.get('authorization') ?? '';
  const expected = Buffer.from('Bearer ' + token);
  const actual = Buffer.from(supplied);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function hasEmptyBody(request: Request): Promise<boolean> {
  if (!request.body) return true;
  const reader = request.body.getReader();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Body read timed out')), 2000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timedOut]);
      if (done) return true;
      if (value.byteLength) return false;
    }
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
    try { await reader.cancel(); } catch { /* The stream may already be closed. */ }
    reader.releaseLock();
  }
}

export const POST: APIRoute = async ({ request }) => {
  const workerToken = process.env.ENQUIRY_WORKER_TOKEN;
  if (!authorized(request, workerToken)) return result(404, { message: 'Not found.' });
  if ((request.headers.has('content-length') && request.headers.get('content-length') !== '0') ||
      !await hasEmptyBody(request)) {
    return result(400, { message: 'Request could not be completed.' });
  }
  const endpoint = notificationEndpoint(process.env.ENQUIRY_NOTIFICATION_ENDPOINT);
  const providerToken = process.env.ENQUIRY_NOTIFICATION_BEARER_TOKEN;
  const client = createServiceClient(process.env, import.meta.env.DEV);
  if (!endpoint || !providerToken || providerToken.length < 32 ||
      providerToken.length > 512 || /\s/.test(providerToken) || !client) {
    return result(503, { message: 'Notification delivery is unavailable.' });
  }

  try {
    const claim = await client.rpc('claim_enquiry_notifications', { p_limit: 10 });
    if (claim.error || !Array.isArray(claim.data)) {
      return result(503, { message: 'Notification delivery is unavailable.' });
    }
    let delivered = 0;
    let retried = 0;
    for (const candidate of claim.data as EnquiryNotification[]) {
      const valid = candidate && typeof candidate.enquiry_id === 'string' &&
        typeof candidate.lease_token === 'string' &&
        (candidate.locale === 'en' || candidate.locale === 'ar') &&
        typeof candidate.name === 'string' && typeof candidate.message === 'string' &&
        typeof candidate.created_at === 'string' &&
        (candidate.email === null || typeof candidate.email === 'string') &&
        (candidate.telephone === null || typeof candidate.telephone === 'string') &&
        (candidate.property_item_id === null || typeof candidate.property_item_id === 'string');
      const status = valid
        ? await deliverEnquiryNotification(endpoint, providerToken, candidate)
        : null;
      const success = status !== null && status >= 200 && status < 300;
      const completed = await client.rpc('finish_enquiry_notification', {
        p_enquiry_id: candidate?.enquiry_id,
        p_lease_token: candidate?.lease_token,
        p_success: success,
        p_http_status: status,
      });
      if (completed.error || completed.data !== true) {
        return result(503, { message: 'Notification delivery is unavailable.' });
      }
      if (success) delivered++;
      else retried++;
    }
    return result(200, { delivered, retried });
  } catch {
    return result(503, { message: 'Notification delivery is unavailable.' });
  }
};

export const ALL: APIRoute = async () => result(404, { message: 'Not found.' });
