import { site } from '../config/site';
import type { Language } from '../types/site';

export function directionFor(language: Language) {
  return site.languages[language].direction;
}
