import { speechLocale } from "../lib/deviceLocale";
import { voiceLanguageFor, type VoiceLanguage } from "../lib/languages";
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
    language: voiceLanguageFor(settings.language),
    appLanguage: settings.language,
    locale: speechLocale(settings.language),
    simpleLanguage: settings.simpleLanguage,
    hapticFeedback: settings.hapticFeedback,
    voiceDebug: settings.voiceDebug,
    setAutoListen: (autoListen: boolean) => updateSettings({ autoListen }),
    setSpeechRate: (speechRate: number) => updateSettings({ speechRate }),
    setLanguage: (voiceLanguage: VoiceLanguage) =>
      updateSettings({ language: voiceLanguage }),
    setVoiceDebug: (voiceDebug: boolean) => updateSettings({ voiceDebug }),
  };
}
