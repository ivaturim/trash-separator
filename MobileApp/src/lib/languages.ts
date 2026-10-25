export const USER_LANGUAGE_KEY = "userLanguage";

export const APP_LANGUAGES = [
  "en",
  "es",
  "zh",
  "hi",
  "ar",
  "fr",
  "pt",
  "ja",
  "ko",
  "ta",
  "bn",
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export type LanguageMeta = {
  id: AppLanguage;
  /** Name in its own script — this is what the switcher shows large. */
  nativeName: string;
  englishName: string;
  locale: string;
  /** 🌐 for Chinese to avoid picking a flag. */
  mark: string;
  rtl: boolean;
  script: "latin" | "cjk" | "devanagari" | "tamil" | "bengali" | "arabic" | "hangul";
};

export const LANGUAGE_META: Record<AppLanguage, LanguageMeta> = {
  en: {
    id: "en",
    nativeName: "English",
    englishName: "English",
    locale: "en-US",
    mark: "🇺🇸",
    rtl: false,
    script: "latin",
  },
  es: {
    id: "es",
    nativeName: "Español",
    englishName: "Spanish",
    locale: "es-ES",
    mark: "🇪🇸",
    rtl: false,
    script: "latin",
  },
  zh: {
    id: "zh",
    nativeName: "简体中文",
    englishName: "Chinese (Simplified)",
    locale: "zh-CN",
    mark: "🌐",
    rtl: false,
    script: "cjk",
  },
  hi: {
    id: "hi",
    nativeName: "हिन्दी",
    englishName: "Hindi",
    locale: "hi-IN",
    mark: "🇮🇳",
    rtl: false,
    script: "devanagari",
  },
  ar: {
    id: "ar",
    nativeName: "العربية",
    englishName: "Arabic",
    locale: "ar-SA",
    mark: "🌐",
    rtl: true,
    script: "arabic",
  },
  fr: {
    id: "fr",
    nativeName: "Français",
    englishName: "French",
    locale: "fr-FR",
    mark: "🇫🇷",
    rtl: false,
    script: "latin",
  },
  pt: {
    id: "pt",
    nativeName: "Português",
    englishName: "Portuguese (Brazil)",
    locale: "pt-BR",
    mark: "🇧🇷",
    rtl: false,
    script: "latin",
  },
  ja: {
    id: "ja",
    nativeName: "日本語",
    englishName: "Japanese",
    locale: "ja-JP",
    mark: "🇯🇵",
    rtl: false,
    script: "cjk",
  },
  ko: {
    id: "ko",
    nativeName: "한국어",
    englishName: "Korean",
    locale: "ko-KR",
    mark: "🇰🇷",
    rtl: false,
    script: "hangul",
  },
  ta: {
    id: "ta",
    nativeName: "தமிழ்",
    englishName: "Tamil",
    locale: "ta-IN",
    mark: "🇮🇳",
    rtl: false,
    script: "tamil",
  },
  bn: {
    id: "bn",
    nativeName: "বাংলা",
    englishName: "Bengali",
    locale: "bn-IN",
    mark: "🇧🇩",
    rtl: false,
    script: "bengali",
  },
};

export const LANGUAGE_ORDER: AppLanguage[] = [...APP_LANGUAGES];

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return !!value && (APP_LANGUAGES as readonly string[]).includes(value);
}

export function localeFor(language: AppLanguage): string {
  return LANGUAGE_META[language].locale;
}

/** Phrasebooks and intent maps exist for these four; others fall back to English. */
export type VoiceLanguage = "en" | "es" | "zh" | "hi";

export function voiceLanguageFor(language: AppLanguage): VoiceLanguage {
  if (language === "en" || language === "es" || language === "zh" || language === "hi") {
    return language;
  }
  return "en";
}

const LANGUAGE_WORD: Record<AppLanguage, string> = {
  en: "Language",
  es: "Idioma",
  zh: "语言",
  hi: "भाषा",
  ar: "اللغة",
  fr: "Langue",
  pt: "Idioma",
  ja: "言語",
  ko: "언어",
  ta: "மொழி",
  bn: "ভাষা",
};

const NEARBY_BY_REGION: Record<string, AppLanguage[]> = {
  IN: ["hi", "ta", "bn", "en"],
  LK: ["ta", "en", "hi", "bn"],
  BD: ["bn", "en", "hi", "ar"],
  CN: ["zh", "en", "ja", "ko"],
  SG: ["zh", "en", "ta", "hi"],
  JP: ["ja", "en", "zh", "ko"],
  KR: ["ko", "en", "ja", "zh"],
  MX: ["es", "en", "pt", "fr"],
  ES: ["es", "en", "fr", "pt"],
  AR: ["es", "en", "pt", "fr"],
  CO: ["es", "en", "pt", "fr"],
  FR: ["fr", "en", "es", "ar"],
  BR: ["pt", "es", "en", "fr"],
  PT: ["pt", "es", "en", "fr"],
  US: ["en", "es", "zh", "hi"],
  GB: ["en", "fr", "es", "ar"],
  SA: ["ar", "en", "hi", "fr"],
  AE: ["ar", "en", "hi", "fr"],
  EG: ["ar", "en", "fr", "es"],
  MA: ["ar", "fr", "en", "es"],
};

/**
 * Settings row title: the word “Language” in four nearby-speaker scripts
 * so the row still jumps out after someone has switched away from English.
 */
export function languageRowLabel(
  current: AppLanguage,
  regionCode?: string,
): string {
  const region = (regionCode ?? "US").toUpperCase();
  const nearby = NEARBY_BY_REGION[region] ?? ["en", "hi", "zh", "es"];
  const langs: AppLanguage[] = [current];
  for (const next of nearby) {
    if (!langs.includes(next)) langs.push(next);
    if (langs.length === 4) break;
  }
  for (const next of APP_LANGUAGES) {
    if (langs.length === 4) break;
    if (!langs.includes(next)) langs.push(next);
  }
  return langs.map((id) => LANGUAGE_WORD[id]).join(" / ");
}

/** Devanagari and CJK need a little more line height than Latin. */
export function scriptScale(language: AppLanguage): number {
  const script = LANGUAGE_META[language].script;
  if (script === "cjk" || script === "devanagari" || script === "tamil" || script === "bengali") {
    return 1.08;
  }
  if (script === "arabic") return 1.05;
  return 1;
}
