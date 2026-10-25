import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { ComponentType } from "react";
import MapView, { Marker, type MapMarkerProps, type MapViewProps } from "react-native-maps";

// react-native-maps types lag React 19's component signature.
const Map = MapView as unknown as ComponentType<MapViewProps>;
const Pin = Marker as unknown as ComponentType<MapMarkerProps>;

import { useTranslation } from "react-i18next";

import { getCenterSource, SEARCH_RADIUS_MILES } from "../lib/centerApi";
import {
  geocodeZip,
  getCurrentCoordinates,
  getPermissionStatus,
  isUsZip,
  requestLocationPermission,
} from "../lib/centerLocation";
import type { Coordinates, LocatedCenter } from "../lib/centerTypes";
import { formatDistanceMiles } from "../lib/format";
import {
  materialLabel,
  materialsForClassification,
} from "../lib/materialMatch";
import type { RootStackParamList } from "../navigation/types";
import { useSettings, useTheme, type Theme } from "../theme/ThemeContext";

type Props = NativeStackScreenProps<RootStackParamList, "NearbyCenters">;

const MAP_HEIGHT = Math.round(Dimensions.get("window").height * 0.4);

export default function NearbyCentersScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);

  function distanceLabel(miles: number): string {
    return formatDistanceMiles(
      miles,
      settings.language,
      settings.unitPreference,
      t("nearby.nearby"),
    );
  }

  function radiusLabel(): string {
    return formatDistanceMiles(
      SEARCH_RADIUS_MILES,
      settings.language,
      settings.unitPreference,
    );
  }

  const filter = useMemo(
    () =>
      materialsForClassification(
        route.params?.material ?? "",
        route.params?.segregation,
      ),
    [route.params?.material, route.params?.segregation],
  );

  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [centers, setCenters] = useState<LocatedCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRationale, setShowRationale] = useState(false);
  const [useZip, setUseZip] = useState(false);
  const [zip, setZip] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function searchFrom(coords: Coordinates) {
    setLoading(true);
    setError(null);
    setOrigin(coords);
    try {
      const found = await getCenterSource().findNear(
        coords.lat,
        coords.lng,
        SEARCH_RADIUS_MILES,
        filter,
      );
      setCenters(found);
      setSelectedId(found[0]?.id ?? null);
    } catch (err) {
      setCenters([]);
      setError(err instanceof Error ? err.message : t("nearby.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const status = await getPermissionStatus();
      if (cancelled) return;

      if (status === "granted") {
        try {
          await searchFrom(await getCurrentCoordinates());
        } catch {
          if (!cancelled) {
            setLoading(false);
            setUseZip(true);
            setError(t("nearby.locationFailed"));
          }
        }
        return;
      }

      setLoading(false);
      if (status === "undetermined") setShowRationale(true);
      else setUseZip(true);
    })();

    return () => {
      cancelled = true;
    };
    // First visit only — later searches are started by the ZIP / retry buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function allowLocation() {
    setShowRationale(false);
    const granted = await requestLocationPermission();
    if (!granted) {
      setUseZip(true);
      return;
    }
    setUseZip(false);
    setLoading(true);
    try {
      await searchFrom(await getCurrentCoordinates());
    } catch {
      setUseZip(true);
      setLoading(false);
      setError(t("nearby.locationFailed"));
    }
  }

  async function searchZip() {
    if (!isUsZip(zip)) {
      setError(t("nearby.invalidZip"));
      return;
    }
    setLoading(true);
    try {
      await searchFrom(await geocodeZip(zip));
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : t("nearby.zipFailed"));
    }
  }

  const filterSummary = filter
    ? t("nearby.filterMaterials", {
        materials: filter.map(materialLabel).join(", ").toLowerCase(),
      })
    : t("nearby.filterAll", { radius: radiusLabel() });

  return (
    <View style={styles.screen}>
      <View style={[styles.mapWrap, { height: MAP_HEIGHT }]}>
        {origin ? (
          <Map
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: origin.lat,
              longitude: origin.lng,
              latitudeDelta: 0.35,
              longitudeDelta: 0.35,
            }}
            showsUserLocation={!useZip}
            accessibilityLabel={t("nearby.mapA11y")}
          >
            <Pin
              coordinate={{ latitude: origin.lat, longitude: origin.lng }}
              title={t("common.you")}
              pinColor={theme.colors.accent}
            />
            {centers.map((center) => (
              <Pin
                key={center.id}
                coordinate={{ latitude: center.lat, longitude: center.lng }}
                title={center.name}
                description={distanceLabel(center.distanceMiles)}
                pinColor={
                  center.id === selectedId
                    ? theme.colors.recyclable
                    : theme.colors.trash
                }
                onPress={() => setSelectedId(center.id)}
              />
            ))}
          </Map>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Feather name="map" size={32} color={theme.colors.textMuted} />
            <Text style={styles.placeholderText}>{t("nearby.mapNeedOrigin")}</Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.listPane}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.filterLine} accessibilityLiveRegion="polite">
          {filterSummary}
        </Text>

        {useZip && (
          <View style={styles.zipRow}>
            <TextInput
              value={zip}
              onChangeText={setZip}
              placeholder={t("nearby.enterZip")}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="number-pad"
              maxLength={5}
              style={styles.zipInput}
              accessibilityLabel={t("nearby.enterZip")}
              accessibilityHint={t("nearby.zipHint")}
            />
            <TouchableOpacity
              style={styles.zipButton}
              onPress={searchZip}
              accessibilityRole="button"
              accessibilityLabel={t("nearby.findCenters")}
            >
              <Text style={styles.zipButtonText}>{t("nearby.findCenters")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.placeholderText}>{t("nearby.looking")}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {centers.length === 0 ? (
              <Text style={styles.placeholderText}>
                {filter
                  ? t("nearby.noCentersMaterial", { radius: radiusLabel() })
                  : t("nearby.noCentersFound", { radius: radiusLabel() })}
              </Text>
            ) : (
              centers.map((center) => {
                const selected = center.id === selectedId;
                return (
                  <TouchableOpacity
                    key={center.id}
                    style={[styles.card, selected && styles.cardSelected]}
                    onPress={() =>
                      navigation.navigate("CenterDetail", {
                        center,
                        distanceMiles: center.distanceMiles,
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${center.name}, ${distanceLabel(center.distanceMiles)}`}
                    accessibilityHint={t("nearby.centerHint")}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{center.name}</Text>
                      <Text style={styles.cardDistance}>
                        {distanceLabel(center.distanceMiles)}
                      </Text>
                    </View>
                    <Text style={styles.cardAddress}>
                      {center.address}, {center.city}
                    </Text>
                    <View style={styles.chips}>
                      {center.acceptedMaterials.slice(0, 4).map((material) => (
                        <View key={material} style={styles.chip}>
                          <Text style={styles.chipText}>
                            {materialLabel(material)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={showRationale}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowRationale(false);
          setUseZip(true);
        }}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Feather name="map-pin" size={36} color={theme.colors.accent} />
            <Text style={styles.modalTitle}>{t("nearby.rationaleTitle")}</Text>
            <Text style={styles.modalBody}>
              {t("nearby.rationaleBody", { radius: radiusLabel() })}
            </Text>
            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={allowLocation}
              accessibilityRole="button"
              accessibilityLabel={t("nearby.allowLocation")}
              accessibilityHint={t("permissions.locationReason")}
            >
              <Text style={styles.modalPrimaryText}>{t("nearby.allowLocation")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={() => {
                setShowRationale(false);
                setUseZip(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("nearby.useZipInstead")}
            >
              <Text style={styles.modalSecondaryText}>{t("nearby.useZipInstead")}</Text>
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
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    mapWrap: {
      backgroundColor: colors.surfaceMuted,
    },
    mapPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 8,
    },
    listPane: {
      flex: 1,
    },
    filterLine: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    zipRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    zipInput: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      color: colors.text,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
      fontSize: 16,
    },
    zipButton: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
    },
    zipButtonText: {
      color: colors.onAccent,
      fontWeight: "800",
    },
    error: {
      color: colors.danger,
      paddingHorizontal: 16,
      paddingTop: 8,
      fontWeight: "600",
    },
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    list: {
      padding: 16,
      paddingBottom: 32,
      gap: 10,
    },
    placeholderText: {
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    cardSelected: {
      borderColor: colors.accent,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    cardTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    cardDistance: {
      color: colors.accent,
      fontWeight: "800",
    },
    cardAddress: {
      color: colors.textMuted,
      marginTop: 4,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 10,
    },
    chip: {
      backgroundColor: colors.accentSurface,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    modalScrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
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
      fontSize: 22,
      fontWeight: "800",
      textAlign: "center",
    },
    modalBody: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21,
      textAlign: "center",
    },
    modalPrimary: {
      alignSelf: "stretch",
      minHeight: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      marginTop: 8,
    },
    modalPrimaryText: {
      color: colors.onAccent,
      fontWeight: "800",
      fontSize: 16,
    },
    modalSecondary: {
      paddingVertical: 10,
    },
    modalSecondaryText: {
      color: colors.accent,
      fontWeight: "700",
    },
  });
}
