import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  type DimensionValue,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { classifyWasteImage, type SegregationResponse } from "../api/trashApi";
import { formatEntryTimestamp } from "../lib/formatDate";
import {
  appendClassification,
  clearClassifications,
  createClassificationEntry,
  loadClassifications,
  type ClassificationEntry,
} from "../lib/historyStore";
import { speechQueue } from "../lib/speechQueue";
import type { RootStackParamList } from "../navigation/types";
import { clearAllConversations } from "../storage/chat";
import { useSettings, useTheme, type Theme } from "../theme/ThemeContext";
import { useVoiceMode } from "../voice/VoiceModeContext";

const RECENT_LIMIT = 5;

type SelectedImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

type CurrentClassification = {
  response: SegregationResponse;
  entry: ClassificationEntry;
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { activate } = useVoiceMode();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [current, setCurrent] = useState<CurrentClassification | null>(null);
  const [history, setHistory] = useState<ClassificationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  // Barcode scans are saved on another screen, so the list is refreshed on
  // focus rather than only on mount.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      loadClassifications()
        .then((stored) => {
          if (isActive) setHistory(stored);
        })
        .catch(() => {
          if (isActive) setHistory([]);
        });
      return () => {
        isActive = false;
      };
    }, []),
  );

  const pendingCapture = route.params?.pendingCapture;

  useEffect(() => {
    if (!pendingCapture) return;
    navigation.setParams({ pendingCapture: undefined });
    if (pendingCapture === "camera") {
      pickFromCamera();
    } else {
      pickFromGallery();
    }
    // The handoff runs once per request; pickers own their own async state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCapture]);

  async function pickFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission needed", "Please allow camera access.");
      return;
    }

    const photo = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!photo.canceled) {
      await classifySelectedImage(photo.assets[0]);
    }
  }

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Gallery permission needed", "Please allow photo access.");
      return;
    }

    const photo = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!photo.canceled) {
      await classifySelectedImage(photo.assets[0]);
    }
  }

  async function classifySelectedImage(image: SelectedImage) {
    setSelectedImage(image);
    setCurrent(null);
    setError(null);
    setIsLoading(true);

    try {
      const response = await classifyWasteImage(image);
      const entry = createClassificationEntry(response, image.uri);
      setCurrent({ response, entry });

      if (settings.readResultsAloud) {
        speechQueue.setRate(settings.speechRate);
        speechQueue.speak(
          `This item is ${response.segregation}. ${response.instruction}`,
          { interrupt: true },
        );
      }

      try {
        setHistory(await appendClassification(entry));
      } catch {
        // A failed history write must not hide a successful classification.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  async function retry() {
    if (selectedImage) {
      await classifySelectedImage(selectedImage);
    }
  }

  async function clearLocalHistory() {
    await clearClassifications();
    await clearAllConversations();
    setHistory([]);
  }

  const isRecyclable = current?.entry.segregation === "recyclable";
  const confidenceWidth: DimensionValue = `${Math.max(
    0,
    Math.min(current?.entry.confidencePercent || 0, 100),
  )}%`;
  const recentHistory = history.slice(0, RECENT_LIMIT);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header">
              Trash Separator
            </Text>
            <Text style={styles.subtitle}>
              Take or upload a photo to classify the waste item.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate("Settings")}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            accessibilityHint="Colour palette, speech speed, voice language and spoken results"
          >
            <Feather name="settings" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.guidedButton}
          onPress={() => navigation.navigate("GuidedMode")}
          accessibilityRole="button"
          accessibilityLabel="Guided mode"
          accessibilityHint="Opens the camera and speaks directions to help you aim, then captures and reads the result aloud"
        >
          <Feather name="volume-2" size={26} color={theme.colors.onAccent} />
          <View style={styles.guidedTextWrap}>
            <Text style={styles.guidedTitle}>Guided Mode</Text>
            <Text style={styles.guidedSubtitle}>
              Spoken help to aim the camera, hands free
            </Text>
          </View>
          <Feather name="chevron-right" size={24} color={theme.colors.onAccent} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.voiceButton}
          onPress={activate}
          accessibilityRole="button"
          accessibilityLabel="Voice mode"
          accessibilityHint="Starts hands-free voice commands for taking photos, history, impact, and questions"
        >
          <Feather name="mic" size={26} color={theme.colors.accent} />
          <View style={styles.guidedTextWrap}>
            <Text style={styles.voiceTitle}>Voice Mode</Text>
            <Text style={styles.voiceSubtitle}>
              Hands-free commands for the whole app
            </Text>
          </View>
          <Feather name="chevron-right" size={24} color={theme.colors.accent} />
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={pickFromCamera}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              accessibilityHint="Opens the camera to photograph a waste item"
            >
              <Text style={styles.primaryButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={pickFromGallery}
              accessibilityRole="button"
              accessibilityLabel="Choose photo"
              accessibilityHint="Picks an existing photo from your library"
            >
              <Text style={styles.secondaryButtonText}>Choose Photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.scanRow}>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => navigation.navigate("BarcodeScanner")}
              accessibilityRole="button"
              accessibilityLabel="Scan barcode"
              accessibilityHint="Best for packaged goods with barcodes"
            >
              <Feather name="maximize" size={18} color={theme.colors.text} />
              <Text style={styles.scanButtonText}>Scan Barcode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => setIsTooltipVisible((visible) => !visible)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="About barcode scanning"
              accessibilityState={{ expanded: isTooltipVisible }}
            >
              <Feather
                name="info"
                size={18}
                color={
                  isTooltipVisible ? theme.colors.accent : theme.colors.textMuted
                }
              />
            </TouchableOpacity>
          </View>

          {isTooltipVisible && (
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>
                Best for packaged goods with barcodes
              </Text>
            </View>
          )}

          {selectedImage && (
            <Image
              source={{ uri: selectedImage.uri }}
              style={styles.previewImage}
              accessibilityIgnoresInvertColors
              accessibilityLabel="The photo being classified"
            />
          )}

          {isLoading && (
            <View style={styles.loadingRow} accessibilityLiveRegion="polite">
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.loadingText}>Classifying image...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorCard} accessibilityLiveRegion="assertive">
              <Text style={styles.errorTitle}>Could not classify image</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel="Retry classification"
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {current && (
            <>
              <View
                style={[
                  styles.resultCard,
                  isRecyclable ? styles.recyclableCard : styles.trashCard,
                ]}
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.resultLabel}>Segregation</Text>
                <Text style={styles.resultTitle}>
                  {current.response.segregation}
                </Text>
                <Text style={styles.resultMessage}>
                  {current.response.instruction}
                </Text>

                <View style={styles.confidenceHeader}>
                  <Text style={styles.confidenceText}>Confidence</Text>
                  <Text style={styles.confidenceText}>
                    {current.entry.confidencePercent.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.confidenceTrack}>
                  <View
                    style={[
                      styles.confidenceFill,
                      { width: confidenceWidth },
                      isRecyclable ? styles.recyclableFill : styles.trashFill,
                    ]}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.askAiButton}
                onPress={() =>
                  navigation.navigate("Chat", { classification: current.entry })
                }
                accessibilityRole="button"
                accessibilityLabel="Ask AI about this item"
                accessibilityHint="Opens a chat to ask follow-up questions"
              >
                <Feather
                  name="message-circle"
                  size={18}
                  color={theme.colors.onAccent}
                />
                <Text style={styles.askAiButtonText}>Ask AI</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.impactRow}
          onPress={() => navigation.navigate("Impact")}
          accessibilityRole="button"
          accessibilityLabel="Your impact"
          accessibilityHint="Shows what your classifications have saved so far"
        >
          <View style={styles.impactIcon}>
            <Feather name="bar-chart-2" size={20} color={theme.colors.accent} />
          </View>
          <View style={styles.impactTextWrap}>
            <Text style={styles.impactTitle}>Your impact</Text>
            <Text style={styles.impactSubtitle}>
              {history.length === 0
                ? "Classify an item to start tracking"
                : `${history.length} ${history.length === 1 ? "item" : "items"} tracked so far`}
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Recent Classifications
          </Text>
          {history.length > 0 && (
            <TouchableOpacity
              onPress={clearLocalHistory}
              accessibilityRole="button"
              accessibilityLabel="Clear history"
              accessibilityHint="Deletes all saved classifications and chats"
            >
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentHistory.length === 0 ? (
          <Text style={styles.emptyHistory}>No history yet.</Text>
        ) : (
          <FlatList
            data={recentHistory}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.historyItem}
                onPress={() =>
                  navigation.navigate("Chat", { classification: item })
                }
                accessibilityRole="button"
                accessibilityLabel={`${item.segregation}, ${
                  item.type === "barcode"
                    ? (item.label ?? "barcode scan")
                    : `${item.confidencePercent.toFixed(0)} percent confidence`
                }, ${formatEntryTimestamp(item.timestamp)}`}
                accessibilityHint="Opens a chat about this item"
              >
                {item.imageUri ? (
                  <Image
                    source={{ uri: item.imageUri }}
                    style={styles.historyImage}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={[styles.historyImage, styles.historyImageFallback]}>
                    <Feather
                      name="package"
                      size={22}
                      color={theme.colors.textMuted}
                    />
                  </View>
                )}
                <View style={styles.historyTextWrap}>
                  <Text style={styles.historyTitle}>{item.segregation}</Text>
                  <Text style={styles.historySubtitle}>
                    {item.type === "barcode"
                      ? (item.label ?? "Barcode scan")
                      : `${item.confidencePercent.toFixed(1)}% confidence`}
                  </Text>
                  <Text style={styles.historyTimestamp}>
                    {formatEntryTimestamp(item.timestamp)}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            )}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  const { colors } = theme;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 20,
      paddingBottom: 112,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 16,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 34,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 16,
      lineHeight: 22,
      marginTop: 6,
    },
    settingsButton: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    guidedButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      minHeight: 88,
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingVertical: 14,
      marginBottom: 14,
      backgroundColor: colors.accent,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    guidedTextWrap: {
      flex: 1,
    },
    guidedTitle: {
      color: colors.onAccent,
      fontSize: 22,
      fontWeight: "900",
    },
    guidedSubtitle: {
      color: colors.onAccent,
      fontSize: 14,
      lineHeight: 19,
      marginTop: 2,
      opacity: 0.9,
    },
    voiceButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      minHeight: 88,
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingVertical: 14,
      marginBottom: 14,
      backgroundColor: colors.accentSurface,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    voiceTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
    },
    voiceSubtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 19,
      marginTop: 2,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 18,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
      shadowColor: "#000000",
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: colors.text,
      borderRadius: 16,
      paddingVertical: 14,
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: {
      color: colors.surface,
      fontWeight: "700",
      fontSize: 16,
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: theme.borderWidth,
      borderRadius: 16,
      paddingVertical: 14,
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    scanRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
    },
    scanButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: theme.borderWidth,
      borderRadius: 16,
      paddingVertical: 14,
      minHeight: 52,
    },
    scanButtonText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    infoButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    tooltip: {
      backgroundColor: colors.accentSurface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 8,
      alignSelf: "flex-end",
    },
    tooltipText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "600",
    },
    previewImage: {
      width: "100%",
      height: 300,
      borderRadius: 18,
      marginTop: 16,
      backgroundColor: colors.surfaceMuted,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginTop: 18,
    },
    loadingText: {
      color: colors.textMuted,
      fontWeight: "600",
    },
    errorCard: {
      backgroundColor: colors.dangerSurface,
      borderRadius: 18,
      padding: 16,
      marginTop: 16,
    },
    errorTitle: {
      color: colors.danger,
      fontWeight: "800",
      fontSize: 16,
    },
    errorText: {
      color: colors.text,
      marginTop: 4,
      lineHeight: 20,
    },
    retryButton: {
      backgroundColor: colors.danger,
      borderRadius: 12,
      alignSelf: "flex-start",
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginTop: 12,
    },
    retryButtonText: {
      color: "#ffffff",
      fontWeight: "700",
    },
    resultCard: {
      borderRadius: 18,
      padding: 18,
      marginTop: 16,
    },
    recyclableCard: {
      backgroundColor: colors.recyclableSurface,
    },
    trashCard: {
      backgroundColor: colors.trashSurface,
    },
    resultLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    resultTitle: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "900",
      textTransform: "capitalize",
      marginTop: 4,
    },
    resultMessage: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      marginTop: 6,
    },
    confidenceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 18,
    },
    confidenceText: {
      color: colors.text,
      fontWeight: "700",
    },
    confidenceTrack: {
      backgroundColor: colors.surface,
      height: 12,
      borderRadius: 999,
      overflow: "hidden",
      marginTop: 8,
    },
    confidenceFill: {
      height: "100%",
      borderRadius: 999,
    },
    recyclableFill: {
      backgroundColor: colors.recyclable,
    },
    trashFill: {
      backgroundColor: colors.trash,
    },
    askAiButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      minHeight: 52,
      marginTop: 12,
    },
    askAiButtonText: {
      color: colors.onAccent,
      fontWeight: "700",
      fontSize: 16,
    },
    historyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 24,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
    },
    clearText: {
      color: colors.danger,
      fontWeight: "700",
    },
    emptyHistory: {
      color: colors.textMuted,
    },
    historyItem: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 10,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    historyImage: {
      width: 74,
      height: 74,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
    },
    historyImageFallback: {
      alignItems: "center",
      justifyContent: "center",
    },
    historyTextWrap: {
      flex: 1,
    },
    historyTitle: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 16,
      textTransform: "capitalize",
    },
    historySubtitle: {
      color: colors.textMuted,
      marginTop: 2,
    },
    historyTimestamp: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 4,
    },
    impactRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      minHeight: 72,
      marginTop: 14,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    impactIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.accentSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    impactTextWrap: {
      flex: 1,
    },
    impactTitle: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 16,
    },
    impactSubtitle: {
      color: colors.textMuted,
      marginTop: 2,
    },
  });
}
