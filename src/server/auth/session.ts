import { createServerClient } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import { configuredOrigin } from './security';

export function settings() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const origin = configuredOrigin(process.env.ADMIN_ORIGIN, import.meta.env.DEV);
  if (!url || !key || !origin) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return { url, key, origin };
  } catch {
    return null;
  }
}

export function createAuthClient(request: Request, cookies: AstroCookies, config: NonNullable<ReturnType<typeof settings>>) {
  const incoming = request.headers.get('cookie') ?? '';
  return createServerClient(config.url, config.key, {
    cookieOptions: { name: '__Host-br-admin', path: '/', secure: true, httpOnly: true, sameSite: 'strict' },
    cookies: {
      getAll() {
        return incoming.split(';').map((part) => part.trim().split('=', 1)[0])
          .filter((name) => name && (name === '__Host-br-admin' || name.startsWith('__Host-br-admin.')))
          .map((name) => ({ name, value: cookies.get(name)?.value ?? '' }));
      },
      setAll(values) {
        for (const { name, value, options } of values) {
          cookies.set(name, value, { ...options, domain: undefined, path: '/', secure: true, httpOnly: true, sameSite: 'strict' });
        }
      },
    },
  });
}

export type AuthClient = ReturnType<typeof createAuthClient>;

export async function membership(client: AuthClient) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const result = await client.from('admin_profiles').select('id, authorized').eq('id', user.id).eq('authorized', true).maybeSingle();
  return !result.error && result.data?.id === user.id && result.data.authorized === true ? user : null;
}

export async function mfaState(client: AuthClient) {
  const factors = await client.auth.mfa.listFactors();
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (factors.error || assurance.error || !factors.data || !assurance.data) return null;
  const verifiedTotp = factors.data.totp.filter((factor) => factor.status === 'verified');
  const hasVerifiedFactor = factors.data.all.some((factor) => factor.status === 'verified');
  const methods = assurance.data.currentAuthenticationMethods;
  const usedTotp = Array.isArray(methods) && methods.some((entry) =>
    typeof entry === 'string' ? entry === 'totp' || entry === 'mfa/totp' : entry?.method === 'totp' || entry?.method === 'mfa/totp');
  return {
    factors: factors.data.all,
    verifiedTotp,
    hasVerifiedFactor,
    authorized: verifiedTotp.length > 0 && assurance.data.currentLevel === 'aal2' && usedTotp,
  };
}
