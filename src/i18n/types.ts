export type {
  Direction,
  Language,
  LanguageConfig,
} from './config.ts';

export type TranslationEntry =
  | string
  | { readonly plural: Readonly<Record<Intl.LDMLPluralRule, string>> };

export type TranslationDictionary = Readonly<Record<string, TranslationEntry>>;

export type InterpolationValues = Readonly<Record<string, string | number>>;

export type TranslationShape<Value> =
  Value extends string
    ? string
    : Value extends { readonly plural: infer Categories }
      ? { readonly plural: { readonly [Category in keyof Categories]: string } }
      : Value extends object
        ? { readonly [Key in keyof Value]: TranslationShape<Value[Key]> }
        : never;
