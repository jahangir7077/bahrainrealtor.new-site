import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';

const MAX_DELIVERY_RESPONSE_BYTES = 4096;
const DELIVERY_TIMEOUT_MS = 8000;

export interface EnquiryNotification {
  enquiry_id: string;
  lease_token: string;
  locale: 'en' | 'ar';
  property_item_id: string | null;
  name: string;
  email: string | null;
  telephone: string | null;
  message: string;
  created_at: string;
}

export function notificationEndpoint(value: string | undefined): URL | null {
  if (!value || value.length > 2048 || value !== value.trim() ||
      value.includes('?') || value.includes('#')) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        !hostname.includes('.') || hostname.endsWith('.') || hostname.includes('..') ||
        isIP(hostname) || hostname === 'localhost' || hostname.endsWith('.localhost') ||
        hostname.endsWith('.local')) return null;
    return url;
  } catch {
    return null;
  }
}

function publicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split('.').map(Number);
    const [a, b, c] = octets;
    if (a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
        (a === 198 && (b === 18 || b === 19 || b === 51)) ||
        (a === 203 && b === 0 && c === 113)) return false;
    return true;
  }
  if (family !== 6 || address.includes('%')) return false;
  const halves = address.toLowerCase().split('::');
  if (halves.length > 2) return false;
  const parseHalf = (half: string): string[] => half ? half.split(':') : [];
  let groups = [...parseHalf(halves[0]), ...parseHalf(halves[1] ?? '')];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return false;
  if (halves.length === 2) {
    const missing = 8 - groups.length;
    if (missing < 1) return false;
    groups = [...parseHalf(halves[0]), ...Array(missing).fill('0'), ...parseHalf(halves[1])];
  }
  if (groups.length !== 8) return false;
  const value = BigInt(`0x${groups.join('')}`);
  const globalUnicast = value >> 125n === 1n; // 2000::/3
  const documentation = value >> 96n === 0x20010db8n;
  const reserved2001 = Number.parseInt(groups[0], 16) === 0x2001 &&
    Number.parseInt(groups[1], 16) <= 0x01ff;
  const sixToFour = Number.parseInt(groups[0], 16) === 0x2002;
  return globalUnicast && !documentation && !reserved2001 && !sixToFour;
}

export async function resolvePublicNotificationAddress(url: URL) {
  let records: Array<{ address: string; family: number }>;
  try {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return null;
  }
  if (!records.length || records.some(({ address }) => !publicIp(address))) return null;
  return records.find(({ family }) => family === 4) ?? records[0] ?? null;
}

export async function deliverEnquiryNotification(
  endpoint: URL,
  bearerToken: string,
  event: EnquiryNotification,
): Promise<number | null> {
  let dnsTimeout: ReturnType<typeof setTimeout> | undefined;
  const address = await Promise.race([
    resolvePublicNotificationAddress(endpoint),
    new Promise<null>((resolve) => {
      dnsTimeout = setTimeout(() => resolve(null), DELIVERY_TIMEOUT_MS);
    }),
  ]);
  if (dnsTimeout) clearTimeout(dnsTimeout);
  if (!address) return null;
  const payload = JSON.stringify({
    event: 'enquiry.created',
    id: event.enquiry_id,
    language: event.locale,
    property_id: event.property_item_id,
    name: event.name,
    email: event.email,
    telephone: event.telephone,
    message: event.message,
    created_at: event.created_at,
  });

  return new Promise((resolve) => {
    const request = httpsRequest(endpoint, {
      method: 'POST',
      agent: false,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      servername: endpoint.hostname.replace(/^\[|\]$/g, ''),
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: {
        authorization: 'Bearer ' + bearerToken,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        'idempotency-key': event.enquiry_id,
      },
    }, (response) => {
      let received = 0;
      let oversized = false;
      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_DELIVERY_RESPONSE_BYTES) {
          oversized = true;
          response.destroy();
        }
      });
      response.on('end', () => resolve(oversized ? null : response.statusCode ?? null));
      response.on('error', () => resolve(null));
    });
    request.setTimeout(DELIVERY_TIMEOUT_MS, () => request.destroy());
    request.on('error', () => resolve(null));
    request.end(payload);
  });
}
