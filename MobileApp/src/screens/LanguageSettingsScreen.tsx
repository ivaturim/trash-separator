import { Feather } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { getFontFamily } from "../lib/fonts";
import { i18n } from "../lib/i18n";
import {
  LANGUAGE_META,
  LANGUAGE_ORDER,
  type AppLanguage,
} from "../lib/languages";
import { applyRtlPreference, needsRtlRestart } from "../lib/rtl";
import { useSettings, useTheme, type Theme } from "../theme/ThemeContext";

export default function LanguageSettingsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [toast, setToast] = useState<string | null>(null);
  const [restartVisible, setRestartVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function selectLanguage(language: AppLanguage) {
    if (language === settings.language) return;

    const restart = needsRtlRestart(language);
    if (restart) applyRtlPreference(language);

    updateSettings({ language });

    const confirm = i18n.getFixedT(language)("settings.languageChanged", {
      name: LANGUAGE_META[language].nativeName,
    });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(confirm);
    toastTimer.current = setTimeout(() => setToast(null), 2200);

    if (restart) setRestartVisible(true);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {LANGUAGE_ORDER.map((id, index) => {
          const meta = LANGUAGE_META[id];
          const selected = settings.language === id;
          const family = getFontFamily(id);
          const nativeFont =
            family === "System" || family === "sans-serif"
              ? undefined
              : family;
          return (
            <TouchableOpacity
              key={id}
              style={[
                styles.row,
                index === 0 && styles.rowFirst,
                index === LANGUAGE_ORDER.length - 1 && styles.rowLast,
              ]}
              onPress={() => selectLanguage(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLanguage={meta.locale}
              accessibilityLabel={`${meta.nativeName}, ${meta.englishName}`}
            >
              <Text style={styles.mark}>{meta.mark}</Text>
              <View style={styles.rowText}>
                <Text
                  style={[
                    styles.nativeName,
                    nativeFont ? { fontFamily: nativeFont } : null,
                  ]}
                >
                  {meta.nativeName}
                </Text>
                <Text style={styles.englishName}>{meta.englishName}</Text>
              </View>
              {selected ? (
                <Feather name="check" size={22} color={theme.colors.accent} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <Modal
        visible={restartVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestartVisible(false)}
      >
        <Pressable
          style={styles.scrim}
          onPress={() => setRestartVisible(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t("language.restartTitle")}</Text>
            <Text style={styles.modalBody}>{t("language.restartBody")}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setRestartVisible(false)}
              accessibilityRole="button"
              accessibilityLabel={t("language.restartOk")}
            >
              <Text style={styles.modalButtonText}>{t("language.restartOk")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 72,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderLeftWidth: theme.borderWidth,
      borderRightWidth: theme.borderWidth,
      borderBottomWidth: theme.borderWidth,
    },
    rowFirst: {
      borderTopWidth: theme.borderWidth,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    rowLast: {
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    rowText: {
      flex: 1,
    },
    mark: {
      fontSize: 22,
      width: 32,
      textAlign: "center",
    },
    nativeName: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    englishName: {
      color: colors.textMuted,
      fontSize: 14,
      marginTop: 2,
    },
    toast: {
      position: "absolute",
      left: 24,
      right: 24,
      bottom: 36,
      backgroundColor: colors.text,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: "center",
    },
    toastText: {
      color: colors.surface,
      fontWeight: "700",
      fontSize: 15,
      textAlign: "center",
    },
    scrim: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
    },
    modalCard: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 22,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    modalBody: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
    },
    modalButton: {
      marginTop: 18,
      backgroundColor: colors.accent,
      borderRadius: 14,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    modalButtonText: {
      color: colors.onAccent,
      fontWeight: "800",
      fontSize: 16,
    },
  });
}
