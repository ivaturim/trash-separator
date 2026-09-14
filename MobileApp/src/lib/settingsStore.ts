import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "appSettings";

export type PaletteId = "standard" | "colorBlind" | "highContrast";

export const MIN_SPEECH_RATE = 0.5;
export const MAX_SPEECH_RATE = 2;
export const SPEECH_RATE_STEP = 0.1;

/** Languages with both an intent keyword map and a spoken phrase set. */
export type VoiceLanguage = "en" | "es" | "zh" | "hi";

export const VOICE_LANGUAGES: {
  id: VoiceLanguage;
  label: string;
  /** BCP-47 tag handed to speech recognition and text to speech. */
  locale: string;
}[] = [
  { id: "en", label: "English", locale: "en-US" },
  { id: "es", label: "Español", locale: "es-ES" },
  { id: "zh", label: "中文", locale: "zh-CN" },
  { id: "hi", label: "हिन्दी", locale: "hi-IN" },
];

export function localeFor(language: VoiceLanguage): string {
  return (
    VOICE_LANGUAGES.find((entry) => entry.id === language)?.locale ?? "en-US"
  );
}

export type AppSettings = {
  palette: PaletteId;
  /** Multiplier passed to expo-speech. 0.95 reads slightly slower than default. */
  speechRate: number;
  /** Guided Mode ignores this and always speaks; other screens honour it. */
  readResultsAloud: boolean;
  /** Starts voice mode as soon as the app opens. */
  autoListen: boolean;
  voiceLanguage: VoiceLanguage;
  /** Shows the voice state machine inspector. Only offered in development. */
  voiceDebug: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  palette: "standard",
  speechRate: 0.95,
  readResultsAloud: true,
  autoListen: false,
  voiceLanguage: "en",
  voiceDebug: false,
};

const PALETTE_IDS: PaletteId[] = ["standard", "colorBlind", "highContrast"];
const LANGUAGE_IDS: VoiceLanguage[] = ["en", "es", "zh", "hi"];

export function clampSpeechRate(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_SETTINGS.speechRate;
  const clamped = Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, rate));
  // Stepping repeatedly accumulates float error, so snap to whole steps.
  return Math.round(clamped * 100) / 100;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseSettings(raw: string | null): AppSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw);
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
      voiceLanguage: LANGUAGE_IDS.includes(parsed?.voiceLanguage)
        ? parsed.voiceLanguage
        : DEFAULT_SETTINGS.voiceLanguage,
      voiceDebug: parseBoolean(parsed?.voiceDebug, DEFAULT_SETTINGS.voiceDebug),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    return parseSettings(await AsyncStorage.getItem(SETTINGS_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
