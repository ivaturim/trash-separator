import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

import CountUpNumber from "../components/CountUpNumber";
import {
  loadClassifications,
  type ClassificationEntry,
} from "../lib/historyStore";
import { summarizeImpact } from "../lib/impactCalculator";

const RECYCLED_COLOR = "#10b981";
const TRASHED_COLOR = "#cbd5e1";
const DONUT_SIZE = 148;
const DONUT_STROKE = 22;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function ImpactScreen() {
  const insets = useSafeAreaInsets();
  const captureAreaRef = useRef<View>(null);
  const [entries, setEntries] = useState<ClassificationEntry[] | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      loadClassifications()
        .then((stored) => {
          if (isActive) setEntries(stored);
        })
        .catch(() => {
          if (isActive) setEntries([]);
        });
      return () => {
        isActive = false;
      };
    }, []),
  );

  const summary = useMemo(
    () => summarizeImpact(entries ?? []),
    [entries],
  );

  async function shareImpact() {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const uri = await captureRef(captureAreaRef, {
        format: "png",
        quality: 0.95,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Sharing unavailable",
          "This device cannot open the share sheet.",
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "My recycling impact",
      });
    } catch {
      Alert.alert(
        "Could not create image",
        "Something went wrong while building your impact summary. Please try again.",
      );
    } finally {
      setIsSharing(false);
    }
  }

  if (entries === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={styles.emptyIllustration}>
          <Feather name="camera" size={44} color="#10b981" />
        </View>
        <Text style={styles.emptyTitle}>
          Take your first photo to start tracking your impact
        </Text>
        <Text style={styles.emptyBody}>
          Every item you classify adds to your recycling totals, your streak,
          and your estimated CO2 and water savings.
        </Text>
      </View>
    );
  }

  const recycledShare =
    summary.totalItems > 0 ? summary.recycledItems / summary.totalItems : 0;
  const radius = (DONUT_SIZE - DONUT_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const maxDayCount = Math.max(...summary.thisWeek.map((day) => day.count), 1);
  const topMaterialMax = Math.max(
    ...summary.topMaterials.map((material) => material.count),
    1,
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View ref={captureAreaRef} collapsable={false} style={styles.captureArea}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total items classified</Text>
          <CountUpNumber value={summary.totalItems} style={styles.heroNumber} />
          <Text style={styles.heroCaption}>
            {summary.recycledItems} recycled · {summary.trashedItems} trashed
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recycled vs trashed</Text>
          <View style={styles.donutRow}>
            <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
              <G rotation={-90} originX={DONUT_SIZE / 2} originY={DONUT_SIZE / 2}>
                <Circle
                  cx={DONUT_SIZE / 2}
                  cy={DONUT_SIZE / 2}
                  r={radius}
                  stroke={TRASHED_COLOR}
                  strokeWidth={DONUT_STROKE}
                  fill="none"
                />
                {recycledShare > 0 && (
                  <Circle
                    cx={DONUT_SIZE / 2}
                    cy={DONUT_SIZE / 2}
                    r={radius}
                    stroke={RECYCLED_COLOR}
                    strokeWidth={DONUT_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${recycledShare * circumference} ${circumference}`}
                    fill="none"
                  />
                )}
              </G>
            </Svg>

            <View style={styles.legend}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: RECYCLED_COLOR }]} />
                <View>
                  <Text style={styles.legendValue}>{summary.recycledItems}</Text>
                  <Text style={styles.legendLabel}>Recycled</Text>
                </View>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: TRASHED_COLOR }]} />
                <View>
                  <Text style={styles.legendValue}>{summary.trashedItems}</Text>
                  <Text style={styles.legendLabel}>Trashed</Text>
                </View>
              </View>
              <Text style={styles.legendShare}>
                {Math.round(recycledShare * 100)}% recyclable
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={[styles.card, styles.statCard]}>
            <Feather name="cloud" size={20} color="#10b981" />
            <CountUpNumber
              value={summary.co2SavedKg}
              decimals={1}
              style={styles.statNumber}
            />
            <Text style={styles.statUnit}>kg CO2 saved</Text>
          </View>
          <View style={[styles.card, styles.statCard]}>
            <Feather name="droplet" size={20} color="#0ea5e9" />
            <CountUpNumber
              value={summary.waterSavedL}
              decimals={1}
              style={styles.statNumber}
            />
            <Text style={styles.statUnit}>litres water saved</Text>
          </View>
        </View>

        <View style={[styles.card, styles.streakCard]}>
          <View style={styles.streakIcon}>
            <Feather name="zap" size={22} color="#f59e0b" />
          </View>
          <View style={styles.streakTextWrap}>
            <CountUpNumber value={summary.streakDays} style={styles.streakNumber} />
            <Text style={styles.streakLabel}>
              {summary.streakDays === 1 ? "day streak" : "day streak"}
            </Text>
          </View>
          <Text style={styles.streakHint}>
            Consecutive days with at least one classification
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top materials</Text>
          {summary.topMaterials.map((material, index) => (
            <View key={material.material} style={styles.materialRow}>
              <Text style={styles.materialRank}>{index + 1}</Text>
              <View style={styles.materialBody}>
                <View style={styles.materialHeader}>
                  <Text style={styles.materialName}>
                    {capitalize(material.material)}
                  </Text>
                  <Text style={styles.materialCount}>{material.count}</Text>
                </View>
                <View style={styles.materialTrack}>
                  <View
                    style={[
                      styles.materialFill,
                      { width: `${(material.count / topMaterialMax) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>This week</Text>
          <View style={styles.weekRow}>
            {summary.thisWeek.map((day) => (
              <View key={day.label} style={styles.weekColumn}>
                <Text style={styles.weekCount}>{day.count > 0 ? day.count : ""}</Text>
                <View style={styles.weekTrack}>
                  <View
                    style={[
                      styles.weekBar,
                      { height: `${(day.count / maxDayCount) * 100}%` },
                      day.count === 0 && styles.weekBarEmpty,
                      day.isToday && styles.weekBarToday,
                    ]}
                  />
                </View>
                <Text style={[styles.weekLabel, day.isToday && styles.weekLabelToday]}>
                  {day.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.shareButton, isSharing && styles.shareButtonBusy]}
        onPress={shareImpact}
        disabled={isSharing}
      >
        {isSharing ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Feather name="share-2" size={18} color="#ffffff" />
        )}
        <Text style={styles.shareButtonText}>Share My Impact</Text>
      </TouchableOpacity>

      <Text style={styles.footnote}>
        Savings are estimates based on average per-item coefficients, not
        measurements of your specific items.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f6f8",
  },
  content: {
    padding: 20,
  },
  captureArea: {
    backgroundColor: "#f5f6f8",
    gap: 14,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f6f8",
    padding: 32,
  },
  emptyIllustration: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 27,
  },
  emptyBody: {
    color: "#6b7280",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  heroLabel: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroNumber: {
    color: "#111827",
    fontSize: 64,
    fontWeight: "900",
    marginTop: 4,
  },
  heroCaption: {
    color: "#6b7280",
    fontSize: 15,
  },
  donutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 14,
  },
  legend: {
    flex: 1,
    gap: 14,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendValue: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "800",
  },
  legendLabel: {
    color: "#6b7280",
    fontSize: 13,
  },
  legendShare: {
    color: "#047857",
    fontWeight: "700",
  },
  statRow: {
    flexDirection: "row",
    gap: 14,
  },
  statCard: {
    flex: 1,
    alignItems: "flex-start",
    gap: 2,
  },
  statNumber: {
    color: "#111827",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  statUnit: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 18,
  },
  streakCard: {
    gap: 6,
  },
  streakIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  streakTextWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  streakNumber: {
    color: "#111827",
    fontSize: 34,
    fontWeight: "900",
  },
  streakLabel: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "700",
    paddingBottom: 4,
  },
  streakHint: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 18,
  },
  materialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  materialRank: {
    color: "#9ca3af",
    fontSize: 15,
    fontWeight: "800",
    width: 14,
  },
  materialBody: {
    flex: 1,
  },
  materialHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  materialName: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 15,
  },
  materialCount: {
    color: "#6b7280",
    fontWeight: "700",
    fontSize: 15,
  },
  materialTrack: {
    backgroundColor: "#f3f4f6",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  materialFill: {
    backgroundColor: "#10b981",
    height: "100%",
    borderRadius: 999,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  weekColumn: {
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  weekCount: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    height: 16,
  },
  weekTrack: {
    height: 96,
    width: 18,
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  weekBar: {
    width: "100%",
    backgroundColor: "#a7f3d0",
    borderRadius: 999,
    minHeight: 4,
  },
  weekBarEmpty: {
    backgroundColor: "transparent",
  },
  weekBarToday: {
    backgroundColor: "#10b981",
  },
  weekLabel: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
  },
  weekLabelToday: {
    color: "#047857",
    fontWeight: "800",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 18,
  },
  shareButtonBusy: {
    opacity: 0.8,
  },
  shareButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  footnote: {
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 12,
  },
});
