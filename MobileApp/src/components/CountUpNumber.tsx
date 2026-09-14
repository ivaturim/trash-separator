import { useEffect, useState } from "react";
import { type StyleProp, Text, type TextStyle } from "react-native";
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  value: number;
  decimals?: number;
  durationMs?: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
};

function formatValue(value: number, decimals: number): string {
  "worklet";
  return value.toFixed(decimals);
}

/**
 * Counts from zero up to `value` whenever it changes. The tween runs on the UI
 * thread and only crosses back to JS when the formatted text actually changes,
 * which keeps re-renders to a few per animation rather than one per frame.
 */
export default function CountUpNumber({
  value,
  decimals = 0,
  durationMs = 900,
  suffix = "",
  style,
}: Props) {
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(() => formatValue(0, decimals));

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(value, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [durationMs, progress, value]);

  useAnimatedReaction(
    () => formatValue(progress.value, decimals),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplay)(current);
      }
    },
    [decimals],
  );

  return (
    <Text style={style}>
      {display}
      {suffix}
    </Text>
  );
}
