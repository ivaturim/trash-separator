import { StyleSheet, Text, type TextProps } from "react-native";

import { localeFor } from "../lib/languages";
import { useTheme } from "../theme/ThemeContext";

/**
 * Applies the script-specific face, a slight size bump for CJK / Indic
 * scripts, and tells VoiceOver / TalkBack which language the string is in.
 */
export default function AppText({ style, ...props }: TextProps) {
  const { theme } = useTheme();
  const flat = StyleSheet.flatten(style);
  const fontSize =
    typeof flat?.fontSize === "number"
      ? flat.fontSize * theme.scriptScale
      : undefined;

  return (
    <Text
      {...props}
      accessibilityLanguage={localeFor(theme.language)}
      style={[
        theme.fontFamily ? { fontFamily: theme.fontFamily } : null,
        style,
        fontSize != null ? { fontSize } : null,
      ]}
    />
  );
}
