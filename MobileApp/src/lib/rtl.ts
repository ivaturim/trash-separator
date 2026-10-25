import { I18nManager, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

import { LANGUAGE_META, type AppLanguage } from "./languages";

export function isRtlLanguage(language: AppLanguage): boolean {
  return LANGUAGE_META[language].rtl;
}

export function layoutIsRtl(): boolean {
  return I18nManager.isRTL;
}

/** True when the OS layout direction does not yet match the chosen language. */
export function needsRtlRestart(language: AppLanguage): boolean {
  return I18nManager.isRTL !== LANGUAGE_META[language].rtl;
}

/**
 * Asks React Native to flip the layout. Takes effect the next time the
 * app process starts, which is why callers show a restart prompt.
 */
export function applyRtlPreference(language: AppLanguage): boolean {
  const wantRtl = LANGUAGE_META[language].rtl;
  if (I18nManager.isRTL === wantRtl) return false;
  I18nManager.allowRTL(wantRtl);
  I18nManager.forceRTL(wantRtl);
  return true;
}

/** Mirror chevrons and arrows until (and after) the layout itself flips. */
export function rtlIconStyle(isRTL: boolean): ViewStyle | undefined {
  return isRTL ? { transform: [{ scaleX: -1 }] } : undefined;
}

export function writingDirection(isRTL: boolean): TextStyle {
  return { writingDirection: isRTL ? "rtl" : "ltr" };
}

export type DirectionalStyle = ViewStyle | TextStyle | ImageStyle;
