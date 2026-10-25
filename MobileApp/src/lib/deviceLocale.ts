import * as Localization from "expo-localization";

import { isAppLanguage, localeFor, type AppLanguage } from "./languages";

export function deviceRegion(): string | undefined {
  return Localization.getLocales()[0]?.regionCode ?? undefined;
}

export function deviceLanguage(): AppLanguage {
  const code = Localization.getLocales()[0]?.languageCode ?? "en";
  return isAppLanguage(code) ? code : "en";
}

/** BCP-47 tag for TTS / STT, including es-MX when the device is in Mexico. */
export function speechLocale(language: AppLanguage): string {
  if (language === "es" && deviceRegion() === "MX") return "es-MX";
  return localeFor(language);
}
