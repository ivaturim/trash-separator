import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import {
  USER_LANGUAGE_KEY,
  isAppLanguage,
  type AppLanguage,
} from "./languages";
import { deviceLanguage } from "./deviceLocale";
import ar from "../locales/ar.json";
import bn from "../locales/bn.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";
import hi from "../locales/hi.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import pt from "../locales/pt.json";
import ta from "../locales/ta.json";
import zh from "../locales/zh.json";

const resources = {
  en: { translation: en },
  es: { translation: es },
  zh: { translation: zh },
  hi: { translation: hi },
  ar: { translation: ar },
  fr: { translation: fr },
  pt: { translation: pt },
  ja: { translation: ja },
  ko: { translation: ko },
  ta: { translation: ta },
  bn: { translation: bn },
};

export async function readStoredLanguage(): Promise<AppLanguage | null> {
  try {
    const stored = await AsyncStorage.getItem(USER_LANGUAGE_KEY);
    return isAppLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

export async function persistLanguage(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(USER_LANGUAGE_KEY, language);
}

export async function initI18n(preferred?: AppLanguage): Promise<AppLanguage> {
  const language = preferred ?? (await readStoredLanguage()) ?? deviceLanguage();

  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  } else if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  return language;
}

export { i18n, USER_LANGUAGE_KEY };
