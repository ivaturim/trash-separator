import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isActive } from "../lib/voiceMachine";
import { useCurrentRouteName } from "../navigation/ref";
import { useTheme } from "../theme/ThemeContext";
import { useVoiceMode } from "../voice/VoiceModeContext";

const SIZE = 64;

/**
 * Persistent microphone control. Hidden while the full overlay is up (that
 * screen has its own larger mic) and while Guided Mode owns the camera.
 */
export default function VoiceFab() {
  const insets = useSafeAreaInsets();
  const { theme, reduceMotion } = useTheme();
  const { context, layout, toggle, interrupt } = useVoiceMode();
  const routeName = useCurrentRouteName();

  const pulse = useSharedValue(1);
  const spin = useSharedValue(0);

  const hidden =
    routeName === "GuidedMode" || (isActive(context) && layout === "full");

  const color =
    context.state === "listening"
      ? theme.colors.recyclable
      : context.state === "thinking"
        ? theme.colors.trash
        : context.state === "speaking"
          ? "#2563eb"
          : theme.colors.textMuted;

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: "absolute",
          right: 20,
          bottom: Math.max(insets.bottom, 12) + 8,
          zIndex: 40,
        },
        button: {
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: color,
          borderWidth: theme.borderWidth,
          borderColor: theme.colors.border,
          shadowColor: "#000000",
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
      }),
    [color, insets.bottom, theme],
  );

  useEffect(() => {
    if (context.state === "listening" && !reduceMotion) {
      pulse.value = withRepeat(
        withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }
  }, [context.state, pulse, reduceMotion]);

  useEffect(() => {
    if (context.state === "thinking" && !reduceMotion) {
      spin.value = withRepeat(withTiming(360, { duration: 900 }), -1, false);
    } else {
      cancelAnimation(spin);
      spin.value = 0;
    }
  }, [context.state, reduceMotion, spin]);

  if (hidden) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View style={pulseStyle}>
        <TouchableOpacity
          style={styles.button}
          onPress={isActive(context) ? interrupt : toggle}
          accessibilityRole="button"
          accessibilityLabel="Toggle voice mode"
          accessibilityHint={
            isActive(context)
              ? "Stops speech and starts listening, or tap again to leave voice mode"
              : "Starts voice mode and listens for a command"
          }
        >
          <Animated.View style={spinStyle}>
            <Feather
              name={
                context.state === "thinking"
                  ? "loader"
                  : context.state === "speaking"
                    ? "volume-2"
                    : "mic"
              }
              size={26}
              color="#ffffff"
            />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
