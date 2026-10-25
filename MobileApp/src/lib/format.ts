import { LANGUAGE_META, type AppLanguage } from "./languages";

export type UnitPreference = "auto" | "metric" | "imperial";

function tag(language: AppLanguage): string {
  return LANGUAGE_META[language].locale;
}

export function usesImperial(
  language: AppLanguage,
  preference: UnitPreference = "auto",
): boolean {
  if (preference === "imperial") return true;
  if (preference === "metric") return false;
  return language === "en";
}

export function formatNumber(
  value: number,
  language: AppLanguage,
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(tag(language), options).format(value);
  } catch {
    return String(value);
  }
}

export function formatPercent(value: number, language: AppLanguage): string {
  try {
    return new Intl.NumberFormat(tag(language), {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value / 100);
  } catch {
    return `${formatNumber(value, language, { maximumFractionDigits: 1 })}%`;
  }
}

/**
 * `meters` is the source unit. en-US (or a forced imperial override) shows
 * miles; everyone else sees kilometres.
 */
export function formatDistance(
  meters: number,
  language: AppLanguage,
  preference: UnitPreference = "auto",
): string {
  if (usesImperial(language, preference)) {
    const miles = meters / 1609.344;
    const formatted =
      miles < 10
        ? formatNumber(miles, language, { maximumFractionDigits: 1 })
        : formatNumber(Math.round(miles), language);
    return `${formatted} mi`;
  }
  const km = meters / 1000;
  const formatted =
    km < 10
      ? formatNumber(km, language, { maximumFractionDigits: 1 })
      : formatNumber(Math.round(km), language);
  return `${formatted} km`;
}

export function formatDate(iso: string, language: AppLanguage): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(tag(language), {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

export function formatDistanceMiles(
  miles: number,
  language: AppLanguage,
  preference: UnitPreference = "auto",
  nearbyLabel = "Nearby",
): string {
  if (miles < 0.1) return nearbyLabel;
  return formatDistance(miles * 1609.344, language, preference);
}

export function formatCurrency(
  amount: number,
  currency: string,
  language: AppLanguage,
): string {
  try {
    return new Intl.NumberFormat(tag(language), {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
