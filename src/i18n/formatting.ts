import { FORMAT_CONFIG, localeConfig, type Language } from './config.ts';

function formatterLocale(language: Language): string {
  return localeConfig[language].regionalLocale;
}

export function formatNumber(value: number, language: Language, maximumFractionDigits = 3): string | null {
  if (!Number.isFinite(value) || !Number.isInteger(maximumFractionDigits) || maximumFractionDigits < 0 || maximumFractionDigits > 20) {
    return null;
  }
  return new Intl.NumberFormat(formatterLocale(language), {
    numberingSystem: localeConfig[language].numberingSystem,
    maximumFractionDigits,
  }).format(value);
}

function parseExactAmount(amount: string | bigint): { negative: boolean; whole: bigint; fraction: string } | null {
  const text = typeof amount === 'bigint' ? amount.toString() : amount;
  if (typeof text !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(text)) return null;
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [wholeText, fraction = ''] = unsigned.split('.');
  return { negative, whole: BigInt(`${negative ? '-' : ''}${wholeText}`), fraction: fraction.replace(/0+$/, '') };
}

export function formatCurrency(amount: string | bigint, language: Language): string | null {
  const parsed = parseExactAmount(amount);
  if (!parsed) return null;
  const regionalLocale = formatterLocale(language);
  const currencyParts = new Intl.NumberFormat(regionalLocale, {
    style: 'currency',
    currency: FORMAT_CONFIG.currency,
    numberingSystem: localeConfig[language].numberingSystem,
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).formatToParts(parsed.whole);
  const integerParts = new Intl.NumberFormat(regionalLocale, {
    numberingSystem: localeConfig[language].numberingSystem,
    maximumFractionDigits: 0,
  }).formatToParts(parsed.whole);
  const firstInteger = currencyParts.findIndex((part) => part.type === 'integer');
  const lastInteger = currencyParts.findLastIndex((part) => part.type === 'integer');
  if (firstInteger < 0 || lastInteger < firstInteger) return null;

  const numericParts = integerParts.filter((part) => part.type === 'integer' || part.type === 'group');
  if (parsed.fraction) {
    const decimal = new Intl.NumberFormat(regionalLocale, {
      numberingSystem: localeConfig[language].numberingSystem,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).formatToParts(1.1).find((part) => part.type === 'decimal');
    if (!decimal) return null;
    numericParts.push(decimal, { type: 'fraction', value: parsed.fraction });
  }

  return [
    ...currencyParts.slice(0, firstInteger),
    ...numericParts,
    ...currencyParts.slice(lastInteger + 1),
  ].map((part) => part.value).join('');
}

export function formatPropertyNumber(value: number, language: Language, maximumFractionDigits = 3): string | null {
  return formatNumber(value, language, maximumFractionDigits);
}

export function formatDate(
  input: Date | string,
  language: Language,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string | null {
  let date: Date;
  if (input instanceof Date) {
    date = new Date(input.getTime());
  } else if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split('-').map(Number);
    date = new Date(Date.UTC(year, month - 1, day, 12));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return null;
  } else if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(input)) {
    date = new Date(input);
  } else {
    return null;
  }

  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(formatterLocale(language), {
    ...options,
    calendar: FORMAT_CONFIG.calendar,
    timeZone: FORMAT_CONFIG.timeZone,
    numberingSystem: localeConfig[language].numberingSystem,
  }).format(date);
}

export function pluralCategory(value: number, language: Language): Intl.LDMLPluralRule {
  return new Intl.PluralRules(formatterLocale(language)).select(value);
}
