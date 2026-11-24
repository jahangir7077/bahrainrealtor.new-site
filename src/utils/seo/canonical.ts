import { site } from '../../config/site.ts';
import type { Language } from '../../i18n/config.ts';
import { detectLanguage, localizedPath, normalizeInternalPath } from '../../i18n/routes.ts';

export function canonicalUrlFor(language: Language, pathname: unknown): string | null {
  const path = normalizeInternalPath(pathname);
  if (!path || detectLanguage(path) === null) return null;
  const localized = localizedPath(path, language);
  if (!localized) return null;
  return new URL(localized, site.productionUrl).href;
}
