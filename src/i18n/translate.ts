import { localeConfig, type Language } from './config.ts';
import type { InterpolationValues, TranslationEntry } from './types.ts';
import { ar } from './translations/ar.ts';
import { en } from './translations/en.ts';

export const dictionaries = { en, ar } as const;
export type TranslationKey = keyof typeof en;

export const ARABIC_TRANSLATION_REVIEW_STATUS = 'proposed-needs-owner-review' as const;

function getEntry(language: Language, key: string): TranslationEntry | undefined {
  const [section, entry] = key.split('.');
  if (!section || !entry || key.split('.').length !== 2) return undefined;
  const dictionary = dictionaries[language] as Record<string, Record<string, TranslationEntry>>;
  return dictionary[section]?.[entry];
}

function interpolate(template: string, values: InterpolationValues = {}): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : token,
  );
}

export function translate(
  language: Language,
  key: TranslationKey | string,
  values: InterpolationValues = {},
): string {
  const entry = getEntry(language, key);
  if (!entry) return `⟦missing translation: ${key}⟧`;

  if (typeof entry === 'string') return interpolate(entry, values);

  const count = values.count;
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return `⟦missing plural count: ${key}⟧`;
  }
  const category = new Intl.PluralRules(localeConfig[language].regionalLocale).select(count);
  const template = entry.plural[category] ?? entry.plural.other;
  return interpolate(template, values);
}

export function validateTranslationCompleteness(): {
  valid: boolean;
  missing: string[];
  extra: string[];
} {
  const leaves = (value: unknown, prefix = ''): string[] => {
    if (typeof value === 'string') return [prefix];
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, child]) =>
        leaves(child, prefix ? `${prefix}.${key}` : key),
      );
    }
    return [];
  };
  const expected = leaves(en);
  const actual = leaves(ar);
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((key) => !actualSet.has(key));
  const extra = actual.filter((key) => !expectedSet.has(key));
  return { valid: missing.length === 0 && extra.length === 0, missing, extra };
}
