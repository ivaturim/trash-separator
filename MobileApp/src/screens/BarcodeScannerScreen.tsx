import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "../navigation/types";
import {
  fetchProductByBarcode,
  ProductLookupError,
} from "../lib/openFoodFactsClient";

type Props = NativeStackScreenProps<RootStackParamList, "BarcodeScanner">;

const GUIDE_WIDTH = 280;
const GUIDE_HEIGHT = 180;

type ScanState =
  | { status: "scanning" }
  | { status: "loading"; barcode: string }
  | { status: "failed"; barcode: string; message: string };

export default function BarcodeScannerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ status: "scanning" });

  // onBarcodeScanned fires continuously, so a ref gates everything after the
  // first accepted frame. State alone would let several lookups start.
  const isHandlingRef = useRef(false);
  const scanLine = useSharedValue(0);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    scanLine.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [scanLine]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLine.value * (GUIDE_HEIGHT - 4) }],
  }));

  async function handleBarcode(barcode: string) {
    if (isHandlingRef.current) return;
    isHandlingRef.current = true;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    setState({ status: "loading", barcode });

    try {
      const product = await fetchProductByBarcode(barcode);
      navigation.replace("BarcodeResult", { product });
    } catch (err) {
      const message =
        err instanceof ProductLookupError
          ? err.message
          : "Could not look up this barcode. Please try again.";
      setState({ status: "failed", barcode, message });
    }
  }

  function scanAgain() {
    isHandlingRef.current = false;
    setState({ status: "scanning" });
  }

  function usePhotoInstead() {
    navigation.navigate("Home", { pendingCapture: "camera" });
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Feather name="camera-off" size={40} color="#f3f4f6" />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          Allow camera access to scan barcodes on packaged items.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>
            {permission.canAskAgain ? "Allow camera" : "Open settings"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={usePhotoInstead}>
          <Text style={styles.linkButtonText}>
            Try photo classification instead
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "itf14"],
        }}
        onBarcodeScanned={
          state.status === "scanning"
            ? ({ data }) => {
                if (data) handleBarcode(data);
              }
            : undefined
        }
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.scrim} />
        <View style={styles.guideRow}>
          <View style={styles.scrim} />
          <View style={styles.guideBox}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            {state.status === "scanning" && (
              <Animated.View style={[styles.scanLine, scanLineStyle]} />
            )}
          </View>
          <View style={styles.scrim} />
        </View>
        <View style={[styles.scrim, styles.bottomScrim]}>
          {state.status === "scanning" && (
            <Text style={styles.hint}>Point camera at barcode</Text>
          )}

          {state.status === "loading" && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" />
              <Text style={styles.hint}>Looking up {state.barcode}...</Text>
            </View>
          )}

          {state.status === "failed" && (
            <View style={styles.failureCard}>
              <Text style={styles.failureTitle}>No packaging data</Text>
              <Text style={styles.failureText}>{state.message}</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={usePhotoInstead}>
                <Text style={styles.primaryButtonText}>
                  Try photo classification instead
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkButton} onPress={scanAgain}>
                <Text style={styles.linkButtonText}>Scan another barcode</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + 10 }]}
        onPress={() => navigation.goBack()}
        hitSlop={10}
      >
        <Feather name="x" size={22} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const SCRIM_COLOR = "rgba(17, 24, 39, 0.72)";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#111827",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    padding: 32,
  },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  scrim: {
    flex: 1,
    backgroundColor: SCRIM_COLOR,
  },
  bottomScrim: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 28,
    paddingHorizontal: 24,
  },
  guideRow: {
    flexDirection: "row",
    height: GUIDE_HEIGHT,
  },
  guideBox: {
    width: GUIDE_WIDTH,
    height: GUIDE_HEIGHT,
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#10b981",
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  scanLine: {
    height: 3,
    marginHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#34d399",
  },
  hint: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  failureCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    width: "100%",
  },
  failureTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  failureText: {
    color: "#4b5563",
    lineHeight: 20,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: "center",
    marginTop: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  linkButtonText: {
    color: "#10b981",
    fontWeight: "700",
    fontSize: 15,
  },
  permissionTitle: {
    color: "#f9fafb",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 16,
  },
  permissionBody: {
    color: "#d1d5db",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },
  closeButton: {
    position: "absolute",
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
