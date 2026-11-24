import { isLanguage, type Language } from '../../i18n/config.ts';

// These primitives do not enable submission. A future endpoint must fail
// closed until distributed rate limiting and a private insertion path exist,
// and must verify property visibility and capture server-owned consent wording.
export const MAX_ENQUIRY_BODY_BYTES = 64 * 1024;

const limits = {
  name: 200,
  email: 320,
  telephone: 100,
  message: 10000,
  propertyReference: 36,
  honeypot: 200,
} as const;

const fields = new Set([
  'name', 'email', 'telephone', 'message', 'propertyReference',
  'language', 'consent', 'honeypot',
]);
const unsafeCharacters = /[\p{Cc}\p{Cs}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

export interface ValidatedEnquiry {
  name: string;
  email: string | null;
  telephone: string | null;
  message: string;
  propertyReference: string | null;
  language: Language;
  consent: true;
}

export type EnquiryValidationResult =
  | { ok: true; enquiry: ValidatedEnquiry }
  | { ok: false; reason: 'invalid' | 'honeypot' };

function text(value: unknown, max: number, multiline = false): string | null {
  if (typeof value !== 'string' || value.length > max) return null;
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n');
  if (normalized.length > max) return null;
  const inspected = multiline ? normalized.replace(/[\n\t]/g, '') : normalized;
  return unsafeCharacters.test(inspected) ? null : normalized.trim();
}

function optionalText(value: unknown, max: number): string | null {
  return value === undefined ? '' : text(value, max);
}

function validEmail(value: string): boolean {
  if (value.length > 254 || !/^[\x21-\x7e]+$/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (local.length > 64 || !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) ||
      local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every((label) =>
    label.length > 0 && label.length <= 63 &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}

function normalizeTelephone(value: string): string | null {
  const westernDigits = value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
  if (!/^\+?[0-9 ()-]+$/.test(westernDigits)) return null;
  const digits = westernDigits.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `${westernDigits.startsWith('+') ? '+' : ''}${digits}`;
}

/**
 * Validate parsed input only. Bound the raw request before parsing and do not log
 * the input or the successful result: both can contain personal information.
 * A valid property UUID still requires a server-side visibility/existence check.
 */
export function validateEnquiry(input: unknown): EnquiryValidationResult {
  const invalid = { ok: false, reason: 'invalid' } as const;
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return invalid;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).some((key) =>
    typeof key !== 'string' || !fields.has(key) ||
    !descriptors[key]?.enumerable || !('value' in descriptors[key]))) return invalid;
  const data: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(descriptors)) data[key] = descriptor.value;

  const honeypot = optionalText(data.honeypot, limits.honeypot);
  if (honeypot === null) return invalid;
  if (data.honeypot !== undefined && data.honeypot !== '') return { ok: false, reason: 'honeypot' };

  const name = text(data.name, limits.name);
  const email = optionalText(data.email, limits.email);
  const telephone = optionalText(data.telephone, limits.telephone);
  const message = text(data.message, limits.message, true);
  const propertyReference = optionalText(data.propertyReference, limits.propertyReference);
  if (!name || email === null || telephone === null || !message ||
      propertyReference === null || !isLanguage(data.language) || data.consent !== true ||
      (!email && !telephone)) return invalid;
  if (email && !validEmail(email)) return invalid;
  const normalizedTelephone = telephone ? normalizeTelephone(telephone) : null;
  if (telephone && !normalizedTelephone) return invalid;
  if (propertyReference && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyReference)) return invalid;

  const normalizedEmail = email ? `${email.slice(0, email.lastIndexOf('@'))}@${email.slice(email.lastIndexOf('@') + 1).toLowerCase()}` : null;
  return {
    ok: true,
    enquiry: {
      name, email: normalizedEmail, telephone: normalizedTelephone, message,
      propertyReference: propertyReference ? propertyReference.toLowerCase() : null,
      language: data.language, consent: true,
    },
  };
}

// JSON.parse accepts duplicate names; reject them before trusting the parsed object.
function hasDuplicateTopLevelKeys(json: string): boolean {
  const keys = new Set<string>();
  let depth = 0;
  let previous = '';
  for (let i = 0; i < json.length; i++) {
    const character = json[i];
    if (character === '"') {
      const start = i;
      while (++i < json.length) {
        if (json[i] === '\\') i++;
        else if (json[i] === '"') break;
      }
      if (depth === 1 && (previous === '{' || previous === ',')) {
        const key: unknown = JSON.parse(json.slice(start, i + 1));
        if (typeof key !== 'string' || keys.has(key)) return true;
        keys.add(key);
      }
      previous = '"';
    } else if (character === '{' || character === '[') {
      depth++;
      previous = character;
    } else if (character === '}' || character === ']') {
      depth--;
      previous = character;
    } else if (!/\s/.test(character)) {
      previous = character;
    }
  }
  return false;
}

/**
 * Read at most MAX_ENQUIRY_BODY_BYTES before JSON parsing. The caller must
 * enforce request timeouts and reject unsupported media types before calling.
 */
export async function readBoundedEnquiryJson(request: Request): Promise<EnquiryValidationResult> {
  const invalid = { ok: false, reason: 'invalid' } as const;
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_ENQUIRY_BODY_BYTES)) return invalid;
  if (!request.body) return invalid;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ENQUIRY_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        return invalid;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(json);
    return hasDuplicateTopLevelKeys(json) ? invalid : validateEnquiry(parsed);
  } catch {
    return invalid;
  } finally {
    reader.releaseLock();
  }
}
