import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTranslation } from "react-i18next";

import { formatDistanceMiles } from "../lib/format";
import { materialLabel } from "../lib/materialMatch";
import type { RootStackParamList } from "../navigation/types";
import { useSettings, useTheme, type Theme } from "../theme/ThemeContext";

type Props = NativeStackScreenProps<RootStackParamList, "CenterDetail">;

function mapsUrl(lat: number, lng: number, name: string): string {
  const query = encodeURIComponent(`${name} @${lat},${lng}`);
  if (Platform.OS === "ios") {
    return `http://maps.apple.com/?daddr=${lat},${lng}&q=${query}`;
  }
  return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`;
}

export default function CenterDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { center, distanceMiles } = route.params;

  const distanceText =
    distanceMiles != null
      ? t("nearby.distance", {
          distance: formatDistanceMiles(
            distanceMiles,
            settings.language,
            settings.unitPreference,
            t("nearby.nearby"),
          ),
        })
      : null;

  const fullAddress = `${center.address}, ${center.city}, ${center.state} ${center.zipCode}`;

  async function callPhone() {
    if (!center.phone) return;
    const digits = center.phone.replace(/[^\d+]/g, "");
    await Linking.openURL(`tel:${digits}`);
  }

  async function openWebsite() {
    if (!center.website) return;
    await Linking.openURL(center.website);
  }

  async function getDirections() {
    await Linking.openURL(mapsUrl(center.lat, center.lng, center.name));
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.name} accessibilityRole="header">
        {center.name}
      </Text>
      {distanceText ? (
        <Text style={styles.distance}>{distanceText}</Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>{t("nearby.address")}</Text>
        <Text style={styles.body}>{fullAddress}</Text>
      </View>

      {center.phone ? (
        <TouchableOpacity
          style={styles.card}
          onPress={callPhone}
          accessibilityRole="button"
          accessibilityLabel={`${t("nearby.call")} ${center.phone}`}
          accessibilityHint={t("nearby.callHint")}
        >
          <Text style={styles.label}>{t("nearby.phone")}</Text>
          <View style={styles.row}>
            <Feather name="phone" size={18} color={theme.colors.accent} />
            <Text style={styles.link}>{center.phone}</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {center.website ? (
        <TouchableOpacity
          style={styles.card}
          onPress={openWebsite}
          accessibilityRole="button"
          accessibilityLabel={t("nearby.openWebsite")}
          accessibilityHint={t("nearby.websiteHint")}
        >
          <Text style={styles.label}>{t("nearby.website")}</Text>
          <View style={styles.row}>
            <Feather name="external-link" size={18} color={theme.colors.accent} />
            <Text style={styles.link} numberOfLines={2}>
              {center.website.replace(/^https?:\/\//, "")}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>{t("nearby.hours")}</Text>
        <Text style={styles.body}>{center.hours}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t("nearby.acceptedMaterials")}</Text>
        <View style={styles.chips}>
          {center.acceptedMaterials.map((material) => (
            <View key={material} style={styles.chip}>
              <Text style={styles.chipText}>{materialLabel(material)}</Text>
            </View>
          ))}
        </View>
      </View>

      {center.notes ? (
        <View style={styles.card}>
          <Text style={styles.label}>{t("nearby.notes")}</Text>
          <Text style={styles.body}>{center.notes}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.directions}
        onPress={getDirections}
        accessibilityRole="button"
        accessibilityLabel={t("nearby.getDirections")}
        accessibilityHint={t("nearby.directionsHint")}
      >
        <Feather name="navigation" size={20} color={theme.colors.onAccent} />
        <Text style={styles.directionsText}>{t("nearby.getDirections")}</Text>
      </TouchableOpacity>
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
      paddingBottom: 40,
      gap: 12,
    },
    name: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
    },
    distance: {
      color: colors.accent,
      fontSize: 16,
      fontWeight: "700",
      marginTop: -4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    body: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    link: {
      flex: 1,
      color: colors.accent,
      fontSize: 16,
      fontWeight: "700",
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      backgroundColor: colors.accentSurface,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    chipText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 13,
    },
    directions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 56,
      borderRadius: 16,
      backgroundColor: colors.accent,
      marginTop: 8,
    },
    directionsText: {
      color: colors.onAccent,
      fontSize: 17,
      fontWeight: "800",
    },
  });
}
