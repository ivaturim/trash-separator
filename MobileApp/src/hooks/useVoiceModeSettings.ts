import {
  localeFor,
  type VoiceLanguage,
} from "../lib/settingsStore";
import { useSettings } from "../theme/ThemeContext";

/**
 * Voice-specific slice of the shared settings store: language, rate, and
 * whether Voice Mode should start itself when the app opens.
 */
export function useVoiceModeSettings() {
  const { settings, settingsReady, updateSettings } = useSettings();

  return {
    ready: settingsReady,
    autoListen: settings.autoListen,
    speechRate: settings.speechRate,
    language: settings.voiceLanguage,
    locale: localeFor(settings.voiceLanguage),
    voiceDebug: settings.voiceDebug,
    setAutoListen: (autoListen: boolean) => updateSettings({ autoListen }),
    setSpeechRate: (speechRate: number) => updateSettings({ speechRate }),
    setLanguage: (voiceLanguage: VoiceLanguage) =>
      updateSettings({ voiceLanguage }),
    setVoiceDebug: (voiceDebug: boolean) => updateSettings({ voiceDebug }),
  };
}
