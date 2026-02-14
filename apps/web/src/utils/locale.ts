export function localeFromLanguage(language: string): string {
  return language.toLowerCase().startsWith("es") ? "es-MX" : "en-US";
}

export function formatCurrencyByLanguage(
  cents: number,
  currency: "MXN" | "USD",
  language: string,
): string {
  return new Intl.NumberFormat(localeFromLanguage(language), {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDateByLanguage(value: Date | string, language: string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(localeFromLanguage(language), {
    dateStyle: "medium",
  }).format(date);
}
