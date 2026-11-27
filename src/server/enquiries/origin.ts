/**
 * No request Host or forwarding header is trusted. Configure an exact origin
 * independently; HTTP is allowed only for explicitly enabled loopback testing.
 */
export function configuredEnquiryOrigin(value: string | undefined, allowLocalHttp = false): string | null {
  if (!value || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        !/^https?:\/\/[^/?#]+\/?$/i.test(value)) return null;
    if (url.protocol !== 'https:' &&
        !(allowLocalHttp && url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Require an exact browser Origin for unsafe methods; absent and opaque origins fail closed. */
export function hasTrustedEnquiryOrigin(request: Request, configuredOrigin: string | null): boolean {
  if (!configuredOrigin || configuredEnquiryOrigin(configuredOrigin, true) !== configuredOrigin ||
      ['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(request.method.toUpperCase())) return false;
  const site = request.headers.get('sec-fetch-site');
  return request.headers.get('origin') === configuredOrigin && (site === null || site === 'same-origin');
}
