import type { Language, LanguageConfig } from '../types/site';

export const site = {
  name: 'BahrainRealtor.com',
  productionUrl: 'https://bahrainrealtor.com/',
  languages: {
    en: { direction: 'ltr' },
    ar: { direction: 'rtl' },
  } satisfies Record<Language, LanguageConfig>,
} as const;
