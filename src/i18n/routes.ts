import type { Language } from './config.ts';
import { isLanguage } from './config.ts';
import { getPublicationEligibility, type PublicationVersion } from './publication.ts';

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;
const LOCALE_LIKE_SEGMENT = /^[a-z]{2}(?:-[A-Za-z]{2})?$/i;

export interface LanguageRoute {
  path: string;
  routeExists: boolean;
  publication?: PublicationVersion;
  developmentOnly?: boolean;
}

export interface BilingualRoute {
  id: string;
  languages: Partial<Record<Language, LanguageRoute>>;
}

export const DEVELOPMENT_HOME_EQUIVALENTS: BilingualRoute = {
  id: 'development-home',
  languages: {
    en: { path: '/', routeExists: true, developmentOnly: true },
    ar: { path: '/ar/', routeExists: true, developmentOnly: true },
  },
};

export type EquivalentResolution =
  | { available: true; href: string; language: Language }
  | {
      available: false;
      reason: 'invalid-path' | 'unsupported-language' | 'current-route-unknown' | 'translation-unavailable';
    };

export function normalizeInternalPath(input: unknown): string | null {
  if (
    typeof input !== 'string' ||
    !input.startsWith('/') ||
    input.startsWith('//') ||
    /[\\%?#\u0000-\u001f\u007f]/.test(input) ||
    input.includes('//')
  ) {
    return null;
  }

  const segments = input.split('/').slice(1);
  if (segments.at(-1) === '') segments.pop();
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || !SAFE_SEGMENT.test(segment))) {
    return input === '/' || input === '/ar/' || input === '/ar' ? (input === '/' ? '/' : '/ar/') : null;
  }

  const path = `/${segments.join('/')}${segments.length ? '/' : ''}`;
  return path || '/';
}

function segmentsFor(path: string): string[] {
  return path.split('/').filter(Boolean);
}

export function detectLanguage(pathname: unknown): Language | null {
  const path = normalizeInternalPath(pathname);
  if (!path) return null;
  const segments = segmentsFor(path);
  const first = segments[0];
  if (first?.toLowerCase() === 'ar') {
    return segments[1]?.toLowerCase() === 'ar' ? null : 'ar';
  }
  if (first && LOCALE_LIKE_SEGMENT.test(first)) return null;
  return 'en';
}

export function removeArabicPrefix(pathname: unknown): string | null {
  const path = normalizeInternalPath(pathname);
  if (!path) return null;
  const segments = segmentsFor(path);
  if (segments[0]?.toLowerCase() === 'ar') segments.shift();
  if (segments[0]?.toLowerCase() === 'ar') return null;
  return `/${segments.join('/')}${segments.length ? '/' : ''}`;
}

export function addLocalePrefix(pathname: unknown, language: Language): string | null {
  const neutralPath = removeArabicPrefix(pathname);
  if (!neutralPath || !isLanguage(language) || detectLanguage(pathname) === null) return null;
  return language === 'ar' ? (neutralPath === '/' ? '/ar/' : `/ar${neutralPath}`) : neutralPath;
}

export function localizedPath(pathname: unknown, language: Language): string | null {
  return addLocalePrefix(pathname, language);
}

export function equivalentRouteCandidates(pathname: unknown): Partial<Record<Language, string>> | null {
  const english = addLocalePrefix(pathname, 'en');
  const arabic = addLocalePrefix(pathname, 'ar');
  return english && arabic ? { en: english, ar: arabic } : null;
}

function routeIsAvailable(route: LanguageRoute, language: Language, environment: 'production' | 'development'): boolean {
  if (!route.routeExists) return false;
  if (environment === 'development' && route.developmentOnly) return true;
  return Boolean(route.publication && getPublicationEligibility(route.publication, language).routeAvailable);
}

export function resolveLanguageEquivalent(
  currentPath: unknown,
  targetLanguage: Language,
  route: BilingualRoute,
  environment: 'production' | 'development' = 'production',
): EquivalentResolution {
  const normalized = normalizeInternalPath(currentPath);
  if (!normalized) return { available: false, reason: 'invalid-path' };

  const currentLanguage = detectLanguage(normalized);
  if (!currentLanguage) return { available: false, reason: 'unsupported-language' };

  const currentRoute = route.languages[currentLanguage];
  if (!currentRoute || normalizeInternalPath(currentRoute.path) !== normalized ||
      !routeIsAvailable(currentRoute, currentLanguage, environment)) {
    return { available: false, reason: 'current-route-unknown' };
  }

  if (!isLanguage(targetLanguage)) return { available: false, reason: 'unsupported-language' };
  const targetRoute = route.languages[targetLanguage];
  if (!targetRoute || !routeIsAvailable(targetRoute, targetLanguage, environment)) {
    return { available: false, reason: 'translation-unavailable' };
  }

  const href = normalizeInternalPath(targetRoute.path);
  if (
    !href ||
    detectLanguage(href) !== targetLanguage ||
    (targetRoute.publication && normalizeInternalPath(targetRoute.publication.routePath) !== href)
  ) {
    return { available: false, reason: 'translation-unavailable' };
  }
  return { available: true, href, language: targetLanguage };
}
