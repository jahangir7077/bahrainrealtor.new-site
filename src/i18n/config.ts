export const DEFAULT_LANGUAGE = 'en' as const;

export const FORMAT_CONFIG = {
  currency: 'BHD',
  timeZone: 'Asia/Bahrain',
  calendar: 'gregory',
} as const;

export const localeConfig = {
  en: {
    language: 'en',
    regionalLocale: 'en-BH',
    languageName: 'English',
    nativeLanguageName: 'English',
    direction: 'ltr',
    urlPrefix: '',
    numberingSystem: 'latn',
    ...FORMAT_CONFIG,
  },
  ar: {
    language: 'ar',
    regionalLocale: 'ar-BH',
    languageName: 'Arabic',
    nativeLanguageName: 'العربية',
    direction: 'rtl',
    urlPrefix: '/ar/',
    numberingSystem: 'latn',
    ...FORMAT_CONFIG,
  },
} as const;

export type Language = keyof typeof localeConfig;
export type Direction = (typeof localeConfig)[Language]['direction'];
export type LanguageConfig = (typeof localeConfig)[Language];

export const supportedLanguages = Object.keys(localeConfig) as Language[];

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && Object.hasOwn(localeConfig, value);
}
