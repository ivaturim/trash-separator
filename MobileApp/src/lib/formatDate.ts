import type { TFunction } from "i18next";

import { formatDate } from "./format";
import { i18n } from "./i18n";
import { isAppLanguage, localeFor, type AppLanguage } from "./languages";

function currentLanguage(explicit?: AppLanguage): AppLanguage {
  if (explicit) return explicit;
  return isAppLanguage(i18n.language) ? i18n.language : "en";
}

export function formatClockTime(isoDate: string, language?: AppLanguage): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(localeFor(currentLanguage(language)), {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Today 9:41 PM", "Yesterday 8:02 AM", or a locale-aware short datetime. */
export function formatEntryTimestamp(
  isoDate: string,
  now: Date = new Date(),
  language?: AppLanguage,
  translate?: TFunction,
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  const lang = currentLanguage(language);
  const time = formatClockTime(isoDate, lang);
  const t = translate ?? ((key: string, opts?: { time: string }) =>
    i18n.t(key, opts));

  if (isSameLocalDay(date, now)) return t("relative.today", { time });

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) return t("relative.yesterday", { time });

  return formatDate(isoDate, lang);
}
