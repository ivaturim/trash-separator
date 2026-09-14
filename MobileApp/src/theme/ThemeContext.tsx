import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo } from "react-native";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AppSettings,
  type PaletteId,
} from "../lib/settingsStore";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentSurface: string;
  onAccent: string;
  recyclable: string;
  recyclableSurface: string;
  trash: string;
  trashSurface: string;
  danger: string;
  dangerSurface: string;
  /** Camera scrim; needs to stay readable over arbitrary video. */
  overlay: string;
  /** Framing brackets drawn over the camera preview. */
  guide: string;
};

export type Theme = {
  id: PaletteId;
  label: string;
  description: string;
  isDark: boolean;
  /** High contrast draws heavier outlines so shapes survive low vision. */
  borderWidth: number;
  colors: ThemeColors;
};

/**
 * `colorBlind` swaps the green/amber pair for blue/orange, which stays
 * distinguishable under protanopia and deuteranopia — the two most common
 * forms — where green and amber collapse into each other.
 */
export const THEMES: Record<PaletteId, Theme> = {
  standard: {
    id: "standard",
    label: "Standard",
    description: "Green for recyclable, amber for trash.",
    isDark: false,
    borderWidth: 1,
    colors: {
      background: "#f5f6f8",
      surface: "#ffffff",
      surfaceMuted: "#f3f4f6",
      text: "#111827",
      textMuted: "#6b7280",
      border: "#d1d5db",
      accent: "#047857",
      accentSurface: "#d1fae5",
      onAccent: "#ffffff",
      recyclable: "#10b981",
      recyclableSurface: "#d1fae5",
      trash: "#f97316",
      trashSurface: "#ffedd5",
      danger: "#dc2626",
      dangerSurface: "#fee2e2",
      overlay: "rgba(17, 24, 39, 0.72)",
      guide: "#34d399",
    },
  },
  colorBlind: {
    id: "colorBlind",
    label: "Colour-blind friendly",
    description: "Blue for recyclable, orange for trash.",
    isDark: false,
    borderWidth: 1,
    colors: {
      background: "#f5f6f8",
      surface: "#ffffff",
      surfaceMuted: "#f3f4f6",
      text: "#111827",
      textMuted: "#5b6472",
      border: "#c7ccd4",
      accent: "#1d4ed8",
      accentSurface: "#dbeafe",
      onAccent: "#ffffff",
      recyclable: "#2563eb",
      recyclableSurface: "#dbeafe",
      trash: "#c2410c",
      trashSurface: "#ffedd5",
      danger: "#b91c1c",
      dangerSurface: "#fee2e2",
      overlay: "rgba(15, 23, 42, 0.74)",
      guide: "#60a5fa",
    },
  },
  highContrast: {
    id: "highContrast",
    label: "High contrast",
    description: "Black background with bright outlines.",
    isDark: true,
    borderWidth: 2,
    colors: {
      background: "#000000",
      surface: "#0b0b0b",
      surfaceMuted: "#1a1a1a",
      text: "#ffffff",
      textMuted: "#e5e7eb",
      border: "#ffffff",
      accent: "#ffd60a",
      accentSurface: "#1a1a1a",
      onAccent: "#000000",
      recyclable: "#00e5a0",
      recyclableSurface: "#05291f",
      trash: "#ffb000",
      trashSurface: "#2b1d00",
      danger: "#ff453a",
      dangerSurface: "#2b0b09",
      overlay: "rgba(0, 0, 0, 0.82)",
      guide: "#ffd60a",
    },
  },
};

type ThemeContextValue = {
  theme: Theme;
  settings: AppSettings;
  /** False until the stored settings have been read (or failed to read). */
  settingsReady: boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** Mirrors the OS "Reduce Motion" switch. */
  reduceMotion: boolean;
  /** True while VoiceOver or TalkBack is running. */
  screenReaderEnabled: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);

  useEffect(() => {
    let isActive = true;
    loadSettings()
      .then((stored) => {
        if (isActive) setSettings(stored);
      })
      .finally(() => {
        if (isActive) setSettingsReady(true);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isActive) setReduceMotion(enabled);
    });
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (isActive) setScreenReaderEnabled(enabled);
    });

    const motionListener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    const readerListener = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReaderEnabled,
    );

    return () => {
      isActive = false;
      motionListener.remove();
      readerListener.remove();
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      // Persist in the background; the UI already reflects the new value.
      saveSettings(next).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: THEMES[settings.palette],
      settings,
      settingsReady,
      updateSettings,
      reduceMotion,
      screenReaderEnabled,
    }),
    [settings, settingsReady, updateSettings, reduceMotion, screenReaderEnabled],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return value;
}

export function useTheme() {
  const { theme, reduceMotion, screenReaderEnabled } = useThemeContext();
  return { theme, colors: theme.colors, reduceMotion, screenReaderEnabled };
}

export function useSettings() {
  const { settings, settingsReady, updateSettings } = useThemeContext();
  return { settings, settingsReady, updateSettings };
}
