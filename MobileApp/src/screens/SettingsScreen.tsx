import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { LANGUAGE_META, languageRowLabel } from "../lib/languages";
import { deviceRegion } from "../lib/deviceLocale";
import { rtlIconStyle } from "../lib/rtl";
import {
  MAX_SPEECH_RATE,
  MIN_SPEECH_RATE,
  SPEECH_RATE_STEP,
  clampSpeechRate,
  type PaletteId,
} from "../lib/settingsStore";
import type { UnitPreference } from "../lib/format";
import { speechQueue } from "../lib/speechQueue";
import type { RootStackParamList } from "../navigation/types";
import { useSettings, useTheme, type Theme } from "../theme/ThemeContext";

const PALETTE_ORDER: PaletteId[] = ["standard", "colorBlind", "highContrast"];
const UNIT_ORDER: { id: UnitPreference; key: "unitsAuto" | "unitsMetric" | "unitsImperial" }[] =
  [
    { id: "auto", key: "unitsAuto" },
    { id: "metric", key: "unitsMetric" },
    { id: "imperial", key: "unitsImperial" },
  ];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const currentLang = LANGUAGE_META[settings.language];

  function changeSpeechRate(delta: number) {
    const next = clampSpeechRate(settings.speechRate + delta);
    updateSettings({ speechRate: next });
    speechQueue.setRate(next);
    speechQueue.speak(t("settings.voiceSpeedValue", { rate: next.toFixed(2) }), {
      interrupt: true,
    });
  }

  function testVoice() {
    speechQueue.setRate(settings.speechRate);
    speechQueue.speak(t("settings.testVoiceSample"), { interrupt: true });
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
        {languageRowLabel(settings.language, deviceRegion())}
      </Text>
      <Text style={styles.sectionHint}>{t("settings.languageHint")}</Text>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate("LanguageSettings")}
          accessibilityRole="button"
          accessibilityLabel={t("settings.language")}
          accessibilityHint={t("settings.languageHint")}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("settings.language")}</Text>
            <Text style={styles.rowSubtitle}>
              {currentLang.nativeName} · {currentLang.englishName}
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={22}
            color={theme.colors.textMuted}
            style={rtlIconStyle(theme.isRTL)}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t("settings.theme")}
      </Text>
      <Text style={styles.sectionHint}>{t("settings.themeHint")}</Text>

      <View style={styles.card}>
        {PALETTE_ORDER.map((id, index) => {
          const isSelected = settings.palette === id;
          const label = t(`theme.${id}`);
          const hint = t(`theme.${id}Hint`);
          return (
            <TouchableOpacity
              key={id}
              style={[styles.row, index > 0 && styles.rowDivider]}
              onPress={() => updateSettings({ palette: id })}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={label}
              accessibilityHint={hint}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{label}</Text>
                <Text style={styles.rowSubtitle}>{hint}</Text>
              </View>
              {isSelected && (
                <Feather name="check" size={22} color={theme.colors.accent} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t("settings.voice")}
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("settings.voiceSpeed")}</Text>
            <Text style={styles.rowSubtitle}>
              {t("settings.voiceSpeedValue", {
                rate: settings.speechRate.toFixed(2),
              })}
            </Text>
          </View>

          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepperButton, !canSlowDown && styles.disabled]}
              onPress={() => changeSpeechRate(-SPEECH_RATE_STEP)}
              disabled={!canSlowDown}
              accessibilityRole="button"
              accessibilityLabel={t("settings.slowDown")}
              accessibilityHint={t("settings.voiceSpeedValue", {
                rate: settings.speechRate.toFixed(2),
              })}
              accessibilityState={{ disabled: !canSlowDown }}
            >
              <Feather name="minus" size={22} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepperButton, !canSpeedUp && styles.disabled]}
              onPress={() => changeSpeechRate(SPEECH_RATE_STEP)}
              disabled={!canSpeedUp}
              accessibilityRole="button"
              accessibilityLabel={t("settings.speedUp")}
              accessibilityHint={t("settings.voiceSpeedValue", {
                rate: settings.speechRate.toFixed(2),
              })}
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
          accessibilityLabel={t("settings.testVoice")}
          accessibilityHint={t("settings.testVoiceHint")}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("settings.testVoice")}</Text>
            <Text style={styles.rowSubtitle}>{t("settings.testVoiceHint")}</Text>
          </View>
          <Feather name="volume-2" size={22} color={theme.colors.accent} />
        </TouchableOpacity>

        <View style={[styles.row, styles.rowDivider]}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("settings.voiceOutput")}</Text>
            <Text style={styles.rowSubtitle}>{t("settings.voiceOutputHint")}</Text>
          </View>
          <Switch
            value={settings.readResultsAloud}
            onValueChange={(value) => updateSettings({ readResultsAloud: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            accessibilityLabel={t("settings.voiceOutput")}
          />
        </View>

        <View style={[styles.row, styles.rowDivider]}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("settings.autoListen")}</Text>
            <Text style={styles.rowSubtitle}>{t("settings.autoListenHint")}</Text>
          </View>
          <Switch
            value={settings.autoListen}
            onValueChange={(value) => updateSettings({ autoListen: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            accessibilityLabel={t("settings.autoListen")}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t("settings.units")}
      </Text>
      <Text style={styles.sectionHint}>{t("settings.unitsHint")}</Text>

      <View style={styles.card}>
        {UNIT_ORDER.map((option, index) => {
          const isSelected = settings.unitPreference === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.row, index > 0 && styles.rowDivider]}
              onPress={() => updateSettings({ unitPreference: option.id })}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(`settings.${option.key}`)}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t(`settings.${option.key}`)}</Text>
              </View>
              {isSelected && (
                <Feather name="check" size={22} color={theme.colors.accent} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t("settings.accessibility")}
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("settings.simpleLanguage")}</Text>
            <Text style={styles.rowSubtitle}>
              {t("settings.simpleLanguageHint")}
            </Text>
          </View>
          <Switch
            value={settings.simpleLanguage}
            onValueChange={(value) => updateSettings({ simpleLanguage: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            accessibilityLabel={t("settings.simpleLanguage")}
          />
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("settings.hapticFeedback")}</Text>
            <Text style={styles.rowSubtitle}>
              {t("settings.hapticFeedbackHint")}
            </Text>
          </View>
          <Switch
            value={settings.hapticFeedback}
            onValueChange={(value) => updateSettings({ hapticFeedback: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            accessibilityLabel={t("settings.hapticFeedback")}
          />
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("settings.reduceMotion")}</Text>
            <Text style={styles.rowSubtitle}>{t("settings.reduceMotionHint")}</Text>
          </View>
          <Switch
            value={settings.reduceMotion}
            onValueChange={(value) => updateSettings({ reduceMotion: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            accessibilityLabel={t("settings.reduceMotion")}
          />
        </View>
      </View>

      {__DEV__ && (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t("settings.voiceDebug")}</Text>
              <Text style={styles.rowSubtitle}>{t("settings.voiceDebugHint")}</Text>
            </View>
            <Switch
              value={settings.voiceDebug}
              onValueChange={(value) => updateSettings({ voiceDebug: value })}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
              accessibilityLabel={t("settings.voiceDebug")}
            />
          </View>
        </View>
      )}

      <Text style={styles.footnote}>{t("settings.footnote")}</Text>
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
      fontSize: 20 * theme.scriptScale,
      fontWeight: "800",
      marginTop: 8,
      fontFamily: theme.fontFamily,
    },
    sectionHint: {
      color: colors.textMuted,
      fontSize: 14 * theme.scriptScale,
      lineHeight: 20,
      marginTop: 4,
      fontFamily: theme.fontFamily,
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
      fontSize: 17 * theme.scriptScale,
      fontWeight: "700",
      fontFamily: theme.fontFamily,
    },
    rowSubtitle: {
      color: colors.textMuted,
      fontSize: 14 * theme.scriptScale,
      lineHeight: 19,
      marginTop: 2,
      fontFamily: theme.fontFamily,
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
      fontSize: 13 * theme.scriptScale,
      lineHeight: 18,
      fontFamily: theme.fontFamily,
    },
  });
}
