import { DEFAULT_LANGUAGE, localeConfig } from '../i18n/config.ts';

export const site = {
  name: 'BahrainRealtor.com',
  productionUrl: 'https://bahrainrealtor.com/',
  defaultLanguage: DEFAULT_LANGUAGE,
  languages: localeConfig,
} as const;
