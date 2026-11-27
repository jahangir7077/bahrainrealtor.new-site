export function configuredOrigin(value: string | undefined, allowLocalHttp = false): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (url.protocol !== 'https:' &&
        !(allowLocalHttp && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function validMutation(request: Request, origin: string | null): boolean {
  if (!origin || request.method !== 'POST' || request.headers.get('origin') !== origin) return false;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  return request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() === 'application/x-www-form-urlencoded';
}

export function protectResponse(response: { headers: Headers }): void {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
}

export function protectedRedirect(response: Response): Response {
  protectResponse(response);
  return response;
}

export async function readForm(request: Request, maxBytes = 8192): Promise<URLSearchParams | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const data = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    return new URLSearchParams(new TextDecoder().decode(data));
  } catch {
    return null;
  }
}

export function one(form: URLSearchParams, key: string, maxLength: number): string | null {
  const values = form.getAll(key);
  return values.length === 1 && values[0].length > 0 && values[0].length <= maxLength ? values[0] : null;
}

const csrfCookie = '__Host-br-csrf';

export function issueCsrfToken(cookies: {
  set(name: string, value: string, options: Record<string, unknown>): void;
}): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  cookies.set(csrfCookie, token, {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 1800,
  });
  return token;
}

export function validCsrfToken(form: URLSearchParams, cookies: {
  get(name: string): { value: string } | undefined;
}): boolean {
  const submitted = one(form, 'csrf', 64);
  const cookie = cookies.get(csrfCookie)?.value;
  if (!submitted || !cookie || !/^[a-f0-9]{64}$/.test(submitted) || !/^[a-f0-9]{64}$/.test(cookie)) return false;
  let difference = 0;
  for (let index = 0; index < submitted.length; index += 1) {
    difference |= submitted.charCodeAt(index) ^ cookie.charCodeAt(index);
  }
  return difference === 0;
}
