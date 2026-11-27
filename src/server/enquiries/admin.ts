import type { AuthClient } from '../auth/session.ts';
import { one } from '../auth/security.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enquiryStatuses = new Set(['new', 'read', 'closed']);

export function parseEnquiryStatusUpdate(form: URLSearchParams) {
  const allowed = new Set(['action', 'id', 'status']);
  if ([...form.keys()].some((key) => !allowed.has(key)) ||
      one(form, 'action', 16) !== 'status') return null;
  const id = one(form, 'id', 36);
  const status = one(form, 'status', 10);
  if (!id || !uuidPattern.test(id) || !status || !enquiryStatuses.has(status)) return null;
  return { id: id.toLowerCase(), status: status as 'new' | 'read' | 'closed' };
}

export async function listEnquiries(client: AuthClient) {
  const result = await client.from('enquiries')
    .select('id,property_item_id,locale,name,email,telephone,message,consent_text,status,created_at')
    .order('created_at', { ascending: false }).limit(100);
  if (result.error || !Array.isArray(result.data)) throw new Error('Enquiry list unavailable');
  return result.data;
}

export async function listEnquiryNotificationStatuses(client: AuthClient, ids: string[]) {
  if (!ids.length) return [];
  const result = await client.from('enquiry_notifications')
    .select('enquiry_id,status,attempts,last_attempt_at,next_attempt_at,delivered_at,last_http_status')
    .in('enquiry_id', ids);
  if (result.error || !Array.isArray(result.data)) throw new Error('Notification status unavailable');
  return result.data;
}

export async function updateEnquiryStatus(
  client: AuthClient,
  update: NonNullable<ReturnType<typeof parseEnquiryStatusUpdate>>,
) {
  const result = await client.from('enquiries').update({ status: update.status })
    .eq('id', update.id).select('id').maybeSingle();
  if (result.error) throw new Error('Enquiry status update failed');
  return result.data?.id === update.id;
}
