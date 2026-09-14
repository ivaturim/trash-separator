import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVoiceModeSettings } from "../hooks/useVoiceModeSettings";
import { isActive, type VoiceState } from "../lib/voiceMachine";
import { useTheme, type Theme } from "../theme/ThemeContext";
import { useVoiceMode } from "../voice/VoiceModeContext";

const COMMANDS: { label: string; transcript: string }[] = [
  { label: "Take photo", transcript: "take a photo" },
  { label: "Choose photo", transcript: "choose a photo" },
  { label: "History", transcript: "my history" },
  { label: "Impact", transcript: "my impact" },
  { label: "Ask", transcript: "ask a question" },
  { label: "Help", transcript: "help" },
];

function stateCopy(state: VoiceState): string {
  if (state === "listening") return "Listening";
  if (state === "thinking") return "Thinking";
  if (state === "speaking") return "Speaking";
  return "Voice mode";
}

function micColor(state: VoiceState, theme: Theme): string {
  if (state === "listening") return theme.colors.recyclable;
  if (state === "thinking") return theme.colors.trash;
  if (state === "speaking") return "#2563eb";
  return theme.colors.textMuted;
}

export default function VoiceModeOverlay() {
  const insets = useSafeAreaInsets();
  const { theme, reduceMotion } = useTheme();
  const { voiceDebug } = useVoiceModeSettings();
  const {
    context,
    layout,
    permissionDenied,
    isAvailable,
    deactivate,
    interrupt,
    submitTranscript,
    setLayout,
    dismissPermission,
  } = useVoiceMode();

  const [draft, setDraft] = useState("");
  const [showTyped, setShowTyped] = useState(!isAvailable);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const pulse = useSharedValue(1);
  const wave = useSharedValue(0.4);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(pulse);
      cancelAnimation(wave);
      pulse.value = 1;
      wave.value = 1;
      return;
    }
    if (context.state === "listening") {
      pulse.value = withRepeat(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }
    if (context.state === "speaking") {
      wave.value = withRepeat(
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(wave);
      wave.value = 0.45;
    }
  }, [context.state, pulse, reduceMotion, wave]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: wave.value }],
  }));

  if (!isActive(context)) return null;

  function sendDraft() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    submitTranscript(text);
  }

  const compact = layout === "compact";

  return (
    <View
      style={styles.root}
      pointerEvents="box-none"
      accessibilityViewIsModal={!compact}
    >
      {!compact && <Pressable style={styles.scrim} onPress={interrupt} />}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.sheetWrap, compact && styles.sheetWrapCompact]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            compact && styles.sheetCompact,
            { paddingBottom: insets.bottom + 12, paddingTop: compact ? 12 : insets.top + 12 },
          ]}
        >
          <View style={styles.topRow}>
            <Text
              style={styles.stateLabel}
              accessibilityLiveRegion="assertive"
              accessibilityRole="text"
            >
              {stateCopy(context.state)}
            </Text>
            <View style={styles.topActions}>
              <TouchableOpacity
                onPress={() => setLayout(compact ? "full" : "compact")}
                accessibilityRole="button"
                accessibilityLabel={compact ? "Expand voice overlay" : "Show the screen behind"}
                hitSlop={8}
              >
                <Feather
                  name={compact ? "maximize-2" : "minimize-2"}
                  size={20}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={deactivate}
                accessibilityRole="button"
                accessibilityLabel="Stop voice mode"
                accessibilityHint="Turns voice mode off and returns to tap controls"
                hitSlop={8}
              >
                <Feather name="x" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {!compact && (
            <TouchableOpacity
              onPress={interrupt}
              accessibilityRole="button"
              accessibilityLabel="Toggle voice mode"
              accessibilityHint="Tap to interrupt speech and start listening"
              style={styles.micHit}
            >
              <Animated.View
                style={[
                  styles.micCircle,
                  { backgroundColor: micColor(context.state, theme) },
                  pulseStyle,
                ]}
              >
                {context.state === "speaking" && !reduceMotion ? (
                  <View style={styles.waveRow}>
                    {[0.6, 1, 0.75, 1.1].map((weight, index) => (
                      <Animated.View
                        key={index}
                        style={[
                          styles.waveBar,
                          waveStyle,
                          { height: 18 * weight },
                        ]}
                      />
                    ))}
                  </View>
                ) : (
                  <Feather
                    name={context.state === "thinking" ? "loader" : "mic"}
                    size={40}
                    color="#ffffff"
                  />
                )}
              </Animated.View>
            </TouchableOpacity>
          )}

          <Text style={styles.transcript} accessibilityLiveRegion="polite">
            {context.transcript ||
              (context.state === "listening"
                ? "Listening…"
                : context.caption || " ")}
          </Text>

          {context.caption && context.state === "speaking" && (
            <View style={styles.captionBand}>
              <Text style={styles.captionText} maxFontSizeMultiplier={1.5}>
                {context.caption}
              </Text>
            </View>
          )}

          {!isAvailable && (
            <Text style={styles.fallbackNote}>
              Spoken input needs a development build. Type a command or use the
              buttons below.
            </Text>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {COMMANDS.map((command) => (
              <TouchableOpacity
                key={command.transcript}
                style={styles.chip}
                onPress={() => submitTranscript(command.transcript)}
                accessibilityRole="button"
                accessibilityLabel={command.label}
              >
                <Text style={styles.chipText}>{command.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {showTyped ? (
            <View style={styles.typeRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type your command instead"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                onSubmitEditing={sendDraft}
                returnKeyType="send"
                accessibilityLabel="Type your command instead"
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={sendDraft}
                accessibilityRole="button"
                accessibilityLabel="Send typed command"
              >
                <Feather name="send" size={18} color={theme.colors.onAccent} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowTyped(true)}
              accessibilityRole="button"
              accessibilityLabel="Type your command instead"
            >
              <Text style={styles.typeLink}>Type your command instead</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.stopButton}
            onPress={deactivate}
            accessibilityRole="button"
            accessibilityLabel="Stop voice mode"
          >
            <Text style={styles.stopText}>STOP</Text>
          </TouchableOpacity>

          {__DEV__ && voiceDebug && (
            <View style={styles.debug}>
              <Text style={styles.debugText}>state: {context.state}</Text>
              <Text style={styles.debugText}>topic: {context.topic}</Text>
              <Text style={styles.debugText}>
                intent: {context.lastIntent ?? "—"} ({context.lastIntentSource ?? "—"})
              </Text>
              <Text style={styles.debugText}>
                transcript: {context.transcript || "—"}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={permissionDenied}
        transparent
        animationType="fade"
        onRequestClose={dismissPermission}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Feather name="mic-off" size={36} color={theme.colors.danger} />
            <Text style={styles.modalTitle}>Microphone access needed</Text>
            <Text style={styles.modalBody}>
              Voice mode can still run from the buttons and the text field.
              Grant microphone access in Settings to speak commands instead.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={dismissPermission}
              accessibilityRole="button"
              accessibilityLabel="Grant permission later"
            >
              <Text style={styles.modalButtonText}>Use buttons instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: Theme) {
  const { colors } = theme;

  return StyleSheet.create({
    root: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 30,
    },
    scrim: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.overlay,
    },
    sheetWrap: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheetWrapCompact: {
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      gap: 12,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    sheetCompact: {
      maxHeight: "46%",
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    topActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    stateLabel: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    micHit: {
      alignSelf: "center",
      marginVertical: 8,
    },
    micCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: "center",
      justifyContent: "center",
    },
    waveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
    },
    waveBar: {
      width: 6,
      borderRadius: 3,
      backgroundColor: "#ffffff",
    },
    transcript: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "700",
      textAlign: "center",
      minHeight: 32,
    },
    captionBand: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    captionText: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
    },
    fallbackNote: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
    },
    chipRow: {
      gap: 8,
      paddingVertical: 2,
    },
    chip: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.accentSurface,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    chipText: {
      color: colors.text,
      fontWeight: "700",
    },
    typeLink: {
      color: colors.accent,
      fontWeight: "700",
      textAlign: "center",
      paddingVertical: 8,
    },
    typeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    input: {
      flex: 1,
      minHeight: 48,
      borderRadius: 16,
      paddingHorizontal: 14,
      backgroundColor: colors.surfaceMuted,
      color: colors.text,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
    },
    stopButton: {
      minHeight: 64,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.danger,
    },
    stopText: {
      color: "#ffffff",
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: 2,
    },
    debug: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      padding: 10,
      gap: 2,
    },
    debugText: {
      color: colors.textMuted,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 11,
    },
    modalScrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
    },
    modalCard: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 22,
      alignItems: "center",
      gap: 10,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    modalBody: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21,
      textAlign: "center",
    },
    modalButton: {
      alignSelf: "stretch",
      minHeight: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      marginTop: 8,
    },
    modalButtonText: {
      color: colors.onAccent,
      fontWeight: "800",
      fontSize: 16,
    },
  });
}
