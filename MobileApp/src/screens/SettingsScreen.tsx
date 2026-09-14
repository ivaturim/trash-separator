import { Feather } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  MAX_SPEECH_RATE,
  MIN_SPEECH_RATE,
  SPEECH_RATE_STEP,
  VOICE_LANGUAGES,
  clampSpeechRate,
  type PaletteId,
} from "../lib/settingsStore";
import { speechQueue } from "../lib/speechQueue";
import { THEMES, useSettings, useTheme, type Theme } from "../theme/ThemeContext";

const PALETTE_ORDER: PaletteId[] = ["standard", "colorBlind", "highContrast"];

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);

  function changeSpeechRate(delta: number) {
    const next = clampSpeechRate(settings.speechRate + delta);
    updateSettings({ speechRate: next });
    speechQueue.setRate(next);
    speechQueue.speak(`Speech speed ${next.toFixed(2)}`, { interrupt: true });
  }

  function testVoice() {
    speechQueue.setRate(settings.speechRate);
    speechQueue.speak(
      "This item is recyclable. Rinse it and place it in the recycling bin.",
      { interrupt: true },
    );
  }

  const canSlowDown = settings.speechRate > MIN_SPEECH_RATE;
  const canSpeedUp = settings.speechRate < MAX_SPEECH_RATE;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Colour
      </Text>
      <Text style={styles.sectionHint}>
        Used across result cards, charts and camera guides.
      </Text>

      <View style={styles.card}>
        {PALETTE_ORDER.map((id, index) => {
          const option = THEMES[id];
          const isSelected = settings.palette === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.row, index > 0 && styles.rowDivider]}
              onPress={() => updateSettings({ palette: id })}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={option.label}
              accessibilityHint={option.description}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{option.label}</Text>
                <Text style={styles.rowSubtitle}>{option.description}</Text>
              </View>
              {isSelected && (
                <Feather name="check" size={22} color={theme.colors.accent} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        Voice
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Speech speed</Text>
            <Text style={styles.rowSubtitle}>
              {settings.speechRate.toFixed(2)}× of normal speed
            </Text>
          </View>

          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepperButton, !canSlowDown && styles.disabled]}
              onPress={() => changeSpeechRate(-SPEECH_RATE_STEP)}
              disabled={!canSlowDown}
              accessibilityRole="button"
              accessibilityLabel="Slow down speech"
              accessibilityHint={`Currently ${settings.speechRate.toFixed(2)} times normal speed`}
              accessibilityState={{ disabled: !canSlowDown }}
            >
              <Feather name="minus" size={22} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepperButton, !canSpeedUp && styles.disabled]}
              onPress={() => changeSpeechRate(SPEECH_RATE_STEP)}
              disabled={!canSpeedUp}
              accessibilityRole="button"
              accessibilityLabel="Speed up speech"
              accessibilityHint={`Currently ${settings.speechRate.toFixed(2)} times normal speed`}
              accessibilityState={{ disabled: !canSpeedUp }}
            >
              <Feather name="plus" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.row, styles.rowDivider]}
          onPress={testVoice}
          accessibilityRole="button"
          accessibilityLabel="Test the voice"
          accessibilityHint="Reads an example result at the current speed"
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Test voice</Text>
            <Text style={styles.rowSubtitle}>Hear an example result.</Text>
          </View>
          <Feather name="volume-2" size={22} color={theme.colors.accent} />
        </TouchableOpacity>

        <View style={[styles.row, styles.rowDivider]}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Read results aloud</Text>
            <Text style={styles.rowSubtitle}>
              Guided Mode and Voice Mode always speak, whatever this is set to.
            </Text>
          </View>
          <Switch
            value={settings.readResultsAloud}
            onValueChange={(value) => updateSettings({ readResultsAloud: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            accessibilityLabel="Read results aloud"
          />
        </View>

        <View style={[styles.row, styles.rowDivider]}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Auto-listen on app open</Text>
            <Text style={styles.rowSubtitle}>
              Starts Voice Mode as soon as the app launches.
            </Text>
          </View>
          <Switch
            value={settings.autoListen}
            onValueChange={(value) => updateSettings({ autoListen: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            accessibilityLabel="Auto-listen on app open"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        Voice mode language
      </Text>
      <Text style={styles.sectionHint}>
        Used for spoken commands and replies. The rest of the app stays in
        English.
      </Text>

      <View style={styles.card}>
        {VOICE_LANGUAGES.map((option, index) => {
          const isSelected = settings.voiceLanguage === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.row, index > 0 && styles.rowDivider]}
              onPress={() => updateSettings({ voiceLanguage: option.id })}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={option.label}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{option.label}</Text>
                <Text style={styles.rowSubtitle}>{option.locale}</Text>
              </View>
              {isSelected && (
                <Feather name="check" size={22} color={theme.colors.accent} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {__DEV__ && (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Voice debug overlay</Text>
              <Text style={styles.rowSubtitle}>
                Shows the state machine, transcript and last intent.
              </Text>
            </View>
            <Switch
              value={settings.voiceDebug}
              onValueChange={(value) => updateSettings({ voiceDebug: value })}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
              accessibilityLabel="Voice debug overlay"
            />
          </View>
        </View>
      )}

      <Text style={styles.footnote}>
        Text size, VoiceOver and Reduce Motion follow your device settings.
      </Text>
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  const { colors } = theme;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 48,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
      marginTop: 8,
    },
    sectionHint: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
      marginTop: 12,
      marginBottom: 20,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    rowDivider: {
      borderTopWidth: theme.borderWidth,
      borderTopColor: colors.border,
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    rowSubtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 19,
      marginTop: 2,
    },
    stepper: {
      flexDirection: "row",
      gap: 8,
    },
    stepperButton: {
      width: 52,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    disabled: {
      opacity: 0.4,
    },
    footnote: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
