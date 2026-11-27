import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

declare const process: { env: Record<string, string | undefined> };

function isLoopback(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export function serviceBackendSettings(
  env: Record<string, string | undefined>,
  allowLocalHttp = false,
) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !(key.startsWith('sb_secret_') || serviceRoleJwt(key))) return null;
  try {
    const parsed = new URL(url);
    const localHttp = allowLocalHttp && parsed.protocol === 'http:' && isLoopback(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !localHttp) || parsed.pathname !== '/' ||
        parsed.username || parsed.password ||
        parsed.search || parsed.hash) return null;
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}

function serviceRoleJwt(key: string): boolean {
  try {
    const part = key.split('.')[1];
    if (!part) return false;
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export function createServiceClient(
  env: Record<string, string | undefined> = process.env,
  allowLocalHttp = false,
) {
  const config = serviceBackendSettings(env, allowLocalHttp);
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
  });
}

export function enquiryRateLimitKey(address: string, secret: string): string | null {
  if (!isIP(address) || secret.length < 32) return null;
  return createHmac('sha256', secret).update(address).digest('hex');
}
