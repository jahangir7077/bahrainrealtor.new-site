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

export function protectResponse(response: Response): void {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
}
