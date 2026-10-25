import AsyncStorage from "@react-native-async-storage/async-storage";

import { deviceLanguage } from "./deviceLocale";
import {
  USER_LANGUAGE_KEY,
  isAppLanguage,
  voiceLanguageFor,
  type AppLanguage,
  type VoiceLanguage,
} from "./languages";
import type { UnitPreference } from "./format";

const SETTINGS_KEY = "appSettings";

export type PaletteId = "standard" | "colorBlind" | "highContrast";

export const MIN_SPEECH_RATE = 0.5;
export const MAX_SPEECH_RATE = 2;
export const SPEECH_RATE_STEP = 0.1;

export type { VoiceLanguage };
export { localeFor } from "./languages";

export type AppSettings = {
  palette: PaletteId;
  /** Multiplier passed to expo-speech. 0.95 reads slightly slower than default. */
  speechRate: number;
  /** Guided Mode ignores this and always speaks; other screens honour it. */
  readResultsAloud: boolean;
  /** Starts voice mode as soon as the app opens. */
  autoListen: boolean;
  /** Whole-app locale. Voice Mode phrasebooks fall back via voiceLanguage. */
  language: AppLanguage;
  /** Kept in sync with `language` for the four-language intent parser. */
  voiceLanguage: VoiceLanguage;
  unitPreference: UnitPreference;
  simpleLanguage: boolean;
  hapticFeedback: boolean;
  /** Extra Reduce Motion on top of the OS switch. */
  reduceMotion: boolean;
  /** Shows the voice state machine inspector. Only offered in development. */
  voiceDebug: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  palette: "standard",
  speechRate: 0.95,
  readResultsAloud: true,
  autoListen: false,
  language: "en",
  voiceLanguage: "en",
  unitPreference: "auto",
  simpleLanguage: false,
  hapticFeedback: true,
  reduceMotion: false,
  voiceDebug: false,
};

const PALETTE_IDS: PaletteId[] = ["standard", "colorBlind", "highContrast"];
const UNIT_IDS: UnitPreference[] = ["auto", "metric", "imperial"];

export function clampSpeechRate(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_SETTINGS.speechRate;
  const clamped = Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, rate));
  return Math.round(clamped * 100) / 100;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function resolveLanguage(
  storedKey: string | null,
  parsed: { language?: unknown; voiceLanguage?: unknown },
): AppLanguage {
  if (isAppLanguage(storedKey)) return storedKey;
  if (isAppLanguage(typeof parsed.language === "string" ? parsed.language : null)) {
    return parsed.language as AppLanguage;
  }
  if (isAppLanguage(typeof parsed.voiceLanguage === "string" ? parsed.voiceLanguage : null)) {
    return parsed.voiceLanguage as AppLanguage;
  }
  return deviceLanguage();
}

function parseSettings(raw: string | null, storedLanguage: string | null): AppSettings {
  if (!raw) {
    const language = resolveLanguage(storedLanguage, {});
    return {
      ...DEFAULT_SETTINGS,
      language,
      voiceLanguage: voiceLanguageFor(language),
    };
  }
  try {
    const parsed = JSON.parse(raw);
    const language = resolveLanguage(storedLanguage, parsed);
    return {
      palette: PALETTE_IDS.includes(parsed?.palette)
        ? parsed.palette
        : DEFAULT_SETTINGS.palette,
      speechRate: clampSpeechRate(Number(parsed?.speechRate)),
      readResultsAloud: parseBoolean(
        parsed?.readResultsAloud,
        DEFAULT_SETTINGS.readResultsAloud,
      ),
      autoListen: parseBoolean(parsed?.autoListen, DEFAULT_SETTINGS.autoListen),
      language,
      voiceLanguage: voiceLanguageFor(language),
      unitPreference: UNIT_IDS.includes(parsed?.unitPreference)
        ? parsed.unitPreference
        : DEFAULT_SETTINGS.unitPreference,
      simpleLanguage: parseBoolean(
        parsed?.simpleLanguage,
        DEFAULT_SETTINGS.simpleLanguage,
      ),
      hapticFeedback: parseBoolean(
        parsed?.hapticFeedback,
        DEFAULT_SETTINGS.hapticFeedback,
      ),
      reduceMotion: parseBoolean(parsed?.reduceMotion, DEFAULT_SETTINGS.reduceMotion),
      voiceDebug: parseBoolean(parsed?.voiceDebug, DEFAULT_SETTINGS.voiceDebug),
    };
  } catch {
    const language = resolveLanguage(storedLanguage, {});
    return {
      ...DEFAULT_SETTINGS,
      language,
      voiceLanguage: voiceLanguageFor(language),
    };
  }
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const [raw, storedLanguage] = await Promise.all([
      AsyncStorage.getItem(SETTINGS_KEY),
      AsyncStorage.getItem(USER_LANGUAGE_KEY),
    ]);
    const settings = parseSettings(raw, storedLanguage);
    if (storedLanguage !== settings.language) {
      await AsyncStorage.setItem(USER_LANGUAGE_KEY, settings.language);
    }
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)),
    AsyncStorage.setItem(USER_LANGUAGE_KEY, settings.language),
  ]);
}
