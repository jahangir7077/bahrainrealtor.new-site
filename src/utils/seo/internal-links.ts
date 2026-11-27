import { normalizeInternalPath } from '../../i18n/routes.ts';

export function validateInternalLinks(paths: readonly unknown[]): {
  valid: string[];
  invalid: unknown[];
} {
  const valid: string[] = [];
  const invalid: unknown[] = [];

  for (const candidate of paths) {
    const path = normalizeInternalPath(candidate);
    if (path) valid.push(path);
    else invalid.push(candidate);
  }

  return { valid, invalid };
}
