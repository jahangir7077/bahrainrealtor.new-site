import type { APIRoute } from 'astro';
import { configuredEnquiryOrigin, hasTrustedEnquiryOrigin } from '../../server/enquiries/origin.ts';
import { createServiceClient, enquiryRateLimitKey } from '../../server/enquiries/backend.ts';
import { enquiryConsentText } from '../../server/enquiries/consent.ts';
import { readBoundedEnquiryJson } from '../../server/enquiries/validation.ts';
import { isLanguage } from '../../i18n/config.ts';
import { isIP } from 'node:net';

declare const process: { env: Record<string, string | undefined> };

export const prerender = false;

function response(status: number, message: string, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'private, no-store, max-age=0');
  headers.set('x-robots-tag', 'noindex, nofollow');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  return new Response(JSON.stringify({ message }), { status, headers });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (request.method !== 'POST') return response(405, 'Request could not be completed.', { allow: 'POST' });
  const origin = configuredEnquiryOrigin(process.env.APP_ORIGIN, import.meta.env.DEV);
  if (!hasTrustedEnquiryOrigin(request, origin)) return response(403, 'Request could not be completed.');
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return response(415, 'Request could not be completed.');
  }

  const settings = createServiceClient(process.env, import.meta.env.DEV);
  const rateSecret = process.env.ENQUIRY_RATE_LIMIT_SECRET;
  if (!settings || !rateSecret || rateSecret.length < 32) {
    return response(503, 'Enquiry submission is unavailable.');
  }
  const address = typeof clientAddress === 'string' && isIP(clientAddress) ? clientAddress : '';
  const bucketKey = enquiryRateLimitKey(address, rateSecret);
  if (!bucketKey) return response(503, 'Enquiry submission is unavailable.');

  try {
    const limited = await settings.rpc('consume_enquiry_rate_limit', { p_bucket_key: bucketKey });
    if (limited.error || typeof limited.data !== 'boolean') return response(503, 'Enquiry submission is unavailable.');
    if (!limited.data) return response(429, 'Please wait before submitting another enquiry.', { 'retry-after': '900' });

    const validation = await readBoundedEnquiryJson(request);
    if (!validation.ok) {
      if (validation.reason === 'honeypot') {
        return response(202, 'Thank you. Your enquiry has been received.');
      }
      return response(400, 'Please check the enquiry details and try again.');
    }

    const enquiry = validation.enquiry;
    if (!isLanguage(enquiry.language)) return response(400, 'Please check the enquiry details and try again.');
    let propertyItemId: string | null = null;
    if (enquiry.propertyReference) {
      const eligibility = await settings.rpc('is_enquiry_property_published', {
        p_item_id: enquiry.propertyReference,
        p_locale: enquiry.language,
      });
      if (eligibility.error || typeof eligibility.data !== 'boolean') {
        return response(503, 'Enquiry submission is unavailable.');
      }
      if (!eligibility.data) return response(422, 'The selected property is unavailable for this enquiry.');
      propertyItemId = enquiry.propertyReference;
    }

    const inserted = await settings.from('enquiries').insert({
      property_item_id: propertyItemId,
      locale: enquiry.language,
      name: enquiry.name,
      email: enquiry.email,
      telephone: enquiry.telephone,
      message: enquiry.message,
      consent: true,
      consent_text: enquiryConsentText[enquiry.language],
    });
    if (inserted.error) return response(503, 'Enquiry submission is unavailable.');
    return response(201, 'Thank you. Your enquiry has been received.');
  } catch {
    return response(503, 'Enquiry submission is unavailable.');
  }
};

export const ALL: APIRoute = async () => response(405, 'Request could not be completed.', { allow: 'POST' });
