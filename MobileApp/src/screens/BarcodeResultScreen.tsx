import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  disposalColors,
  ecoscoreColor,
  ecoscoreLabel,
  suggestDisposal,
  type Recyclability,
} from "../lib/ecoscore";
import { appendClassification, createBarcodeEntry } from "../lib/historyStore";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "BarcodeResult">;

const RECYCLABILITY_ICON: Record<
  Recyclability,
  { name: keyof typeof Feather.glyphMap; color: string }
> = {
  recyclable: { name: "refresh-cw", color: "#047857" },
  trash: { name: "trash-2", color: "#c2410c" },
  unknown: { name: "help-circle", color: "#6b7280" },
};

export default function BarcodeResultScreen({ navigation, route }: Props) {
  const { product } = route.params;
  const insets = useSafeAreaInsets();
  const hasSavedRef = useRef(false);

  const { disposal, headline, detail } = useMemo(
    () => suggestDisposal(product.components),
    [product.components],
  );

  const productTitle = product.name ?? `Barcode ${product.barcode}`;
  const colors = disposalColors(disposal);
  const gradeColor = ecoscoreColor(product.ecoscoreGrade);

  // Scans are recorded once, and only when the packaging data was conclusive
  // enough to map onto a recyclable/trash bucket.
  useEffect(() => {
    if (hasSavedRef.current || disposal === "unknown") return;
    hasSavedRef.current = true;

    const dominant =
      product.components.find(
        (component) => component.recyclability === "recyclable",
      ) ?? product.components[0];

    appendClassification(
      createBarcodeEntry({
        segregation: disposal === "trash" ? "trash" : "recyclable",
        material: (dominant?.material ?? "packaging").toLowerCase(),
        imageUri: product.imageUrl ?? "",
        label: productTitle,
      }),
    ).catch(() => undefined);
  }, [disposal, product.components, product.imageUrl, productTitle]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.productRow}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
          ) : (
            <View style={[styles.productImage, styles.productImageFallback]}>
              <Feather name="package" size={26} color="#9ca3af" />
            </View>
          )}

          <View style={styles.productTextWrap}>
            <Text style={styles.productName}>{productTitle}</Text>
            {product.brand && (
              <Text style={styles.productBrand}>{product.brand}</Text>
            )}
            <Text style={styles.productBarcode}>{product.barcode}</Text>
          </View>
        </View>

        <View style={styles.ecoscoreRow}>
          <View style={[styles.ecoscoreBadge, { backgroundColor: gradeColor }]}>
            <Text style={styles.ecoscoreGrade}>
              {product.ecoscoreGrade === "unknown"
                ? "?"
                : product.ecoscoreGrade.toUpperCase()}
            </Text>
          </View>
          <View style={styles.ecoscoreTextWrap}>
            <Text style={styles.ecoscoreTitle}>Eco-Score</Text>
            <Text style={styles.ecoscoreLabel}>
              {ecoscoreLabel(product.ecoscoreGrade)}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, styles.disposalCard, { backgroundColor: colors.background }]}>
        <Text style={[styles.disposalLabel, { color: colors.accent }]}>
          Best disposal
        </Text>
        <Text style={styles.disposalHeadline}>{headline}</Text>
        <Text style={styles.disposalDetail}>{detail}</Text>
      </View>

      {product.components.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Packaging</Text>
          {product.components.map((component, index) => {
            const icon = RECYCLABILITY_ICON[component.recyclability];
            return (
              <View
                key={`${component.material}-${component.shape}-${index}`}
                style={styles.componentRow}
              >
                <Feather name={icon.name} size={18} color={icon.color} />
                <View style={styles.componentTextWrap}>
                  <Text style={styles.componentMaterial}>
                    {component.shape
                      ? `${component.material} · ${component.shape}`
                      : component.material}
                  </Text>
                  <Text style={styles.componentAdvice}>{component.advice}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {product.packagingText && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Packaging notes</Text>
          <Text style={styles.packagingText}>{product.packagingText}</Text>
        </View>
      )}

      {disposal === "unknown" && (
        <TouchableOpacity
          style={styles.fallbackButton}
          onPress={() => navigation.navigate("Home", { pendingCapture: "camera" })}
        >
          <Feather name="camera" size={18} color="#ffffff" />
          <Text style={styles.fallbackButtonText}>
            Try photo classification instead
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate("BarcodeScanner")}
      >
        <Feather name="maximize" size={18} color="#111827" />
        <Text style={styles.secondaryButtonText}>Scan another item</Text>
      </TouchableOpacity>

      <Text style={styles.footnote}>
        Packaging and Eco-Score data comes from Open Food Facts and is
        contributed by volunteers, so it can be incomplete or out of date.
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
    gap: 14,
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
  productRow: {
    flexDirection: "row",
    gap: 14,
  },
  productImage: {
    width: 84,
    height: 84,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  productImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  productTextWrap: {
    flex: 1,
    justifyContent: "center",
  },
  productName: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  productBrand: {
    color: "#4b5563",
    fontSize: 15,
    marginTop: 2,
  },
  productBarcode: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 4,
  },
  ecoscoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 18,
    borderTopColor: "#f3f4f6",
    borderTopWidth: 1,
    paddingTop: 16,
  },
  ecoscoreBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ecoscoreGrade: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
  },
  ecoscoreTextWrap: {
    flex: 1,
  },
  ecoscoreTitle: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 16,
  },
  ecoscoreLabel: {
    color: "#6b7280",
    lineHeight: 19,
    marginTop: 2,
  },
  disposalCard: {
    shadowOpacity: 0,
    elevation: 0,
  },
  disposalLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  disposalHeadline: {
    color: "#111827",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },
  disposalDetail: {
    color: "#374151",
    fontSize: 16,
    lineHeight: 22,
    marginTop: 6,
  },
  sectionTitle: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  componentRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  componentTextWrap: {
    flex: 1,
  },
  componentMaterial: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 15,
  },
  componentAdvice: {
    color: "#6b7280",
    lineHeight: 19,
    marginTop: 2,
  },
  packagingText: {
    color: "#374151",
    lineHeight: 21,
    marginTop: 8,
  },
  fallbackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    paddingVertical: 15,
  },
  fallbackButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 15,
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 16,
  },
  footnote: {
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});
