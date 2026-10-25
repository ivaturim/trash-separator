import { Platform } from "react-native";

import type { AppLanguage } from "./languages";

/**
 * Script-specific faces. Expo Go cannot ship the full Noto family without a
 * custom binary, so we pick the OS faces that already cover each script
 * (Noto on Android, Apple's Sangam / PingFang / Hiragino / Geeza on iOS).
 * Drop TTF files named NotoSans*-Regular.ttf into assets/fonts/ later if
 * you want the same face on every device.
 */
const IOS: Record<AppLanguage, string> = {
  en: "System",
  es: "System",
  fr: "System",
  pt: "System",
  zh: "PingFang SC",
  ja: "Hiragino Sans",
  ko: "Apple SD Gothic Neo",
  hi: "Devanagari Sangam MN",
  ta: "Tamil Sangam MN",
  bn: "Bangla Sangam MN",
  ar: "Geeza Pro",
};

const ANDROID: Record<AppLanguage, string> = {
  en: "sans-serif",
  es: "sans-serif",
  fr: "sans-serif",
  pt: "sans-serif",
  zh: "sans-serif",
  ja: "sans-serif",
  ko: "sans-serif",
  hi: "sans-serif",
  ta: "sans-serif",
  bn: "sans-serif",
  ar: "sans-serif",
};

export function getFontFamily(language: AppLanguage): string {
  return Platform.OS === "ios" ? IOS[language] : ANDROID[language];
}
