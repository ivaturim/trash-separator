import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Accelerometer } from "expo-sensors";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
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

import { classifyWasteImage, type SegregationResponse } from "../api/trashApi";
import { captureAnalysisFrame } from "../lib/cameraFrames";
import {
  ShakeDetector,
  StabilityTracker,
  cueLabel,
  cueSpeech,
  decideCue,
  type Cue,
} from "../lib/frameGuidance";
import {
  appendClassification,
  createClassificationEntry,
  type ClassificationEntry,
} from "../lib/historyStore";
import { speechQueue } from "../lib/speechQueue";
import { localeFor } from "../lib/settingsStore";
import {
  getSpeechRecognizer,
  parseVoiceCommand,
  type SpeechRecognizer,
  type VoiceCommand,
} from "../lib/voiceCommands";
import type { RootStackParamList } from "../navigation/types";
import { useSettings, useTheme, type Theme } from "../theme/ThemeContext";

type Props = NativeStackScreenProps<RootStackParamList, "GuidedMode">;

type Phase =
  | "starting"
  | "guiding"
  | "countdown"
  | "capturing"
  | "analyzing"
  | "result"
  | "failed";

/**
 * Target gap between framing samples. The real cadence is slower because it
 * also includes the time to take and decode a still, which is the price of
 * having no frame stream in Expo Go.
 */
const FRAME_INTERVAL_MS = 400;
const CUE_INTERVAL_MS = 1500;
const NO_OBJECT_PROMPT_MS = 15000;
const DARK_PROMPT_MS = 8000;

const INTRO =
  "Guided mode is active. Hold your phone about one foot from the trash item. I will guide you into position.";

export default function GuidedModeScreen({ navigation }: Props) {
  const { theme, reduceMotion } = useTheme();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>("starting");
  const [status, setStatus] = useState("Starting guided mode");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [result, setResult] = useState<{
    response: SegregationResponse;
    entry: ClassificationEntry;
  } | null>(null);

  const cameraRef = useRef<CameraView | null>(null);
  const isMountedRef = useRef(true);
  const isCameraReadyRef = useRef(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // The sampling loop reads its state through refs so a scheduled tick always
  // sees current values rather than the render it was created in.
  const phaseRef = useRef<Phase>("starting");
  const frameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCueAtRef = useRef(0);
  const lastDarkAtRef = useRef(0);
  const lastNoObjectAtRef = useRef(0);
  const objectMissingSinceRef = useRef<number | null>(null);
  const shakeRef = useRef(new ShakeDetector());
  const stabilityRef = useRef(new StabilityTracker());
  // Registered once at startup, so reading it during the first render is safe.
  const recognizerRef = useRef<SpeechRecognizer | null>(getSpeechRecognizer());

  const styles = useMemo(() => createStyles(theme), [theme]);
  const guideSize = Math.round(width * 0.6);
  const canUseVoice = recognizerRef.current !== null;

  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  function changePhase(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function cancelFrameLoop() {
    if (frameTimerRef.current) {
      clearTimeout(frameTimerRef.current);
      frameTimerRef.current = null;
    }
  }

  function scheduleNextFrame(delay = FRAME_INTERVAL_MS) {
    cancelFrameLoop();
    frameTimerRef.current = setTimeout(runGuidanceTick, delay);
  }

  async function runGuidanceTick() {
    if (!isMountedRef.current || phaseRef.current !== "guiding") return;

    const camera = cameraRef.current;
    if (!camera || !isCameraReadyRef.current) {
      scheduleNextFrame();
      return;
    }

    const analysis = await captureAnalysisFrame(camera);

    // The phase can change mid-capture, for example when the user hits STOP.
    if (!isMountedRef.current || phaseRef.current !== "guiding") return;

    if (!analysis) {
      scheduleNextFrame();
      return;
    }

    const cue = decideCue(analysis, { isShaking: shakeRef.current.isShaking() });
    announceCue(cue);

    if (stabilityRef.current.push(cue)) {
      startCountdown();
      return;
    }

    scheduleNextFrame();
  }

  function announceCue(cue: Cue) {
    setStatus(cueLabel(cue));

    const now = Date.now();
    // Cues are advisory, so they are dropped rather than queued whenever the
    // user is already being spoken to.
    if (speechQueue.isBusy) return;

    if (cue === "dark") {
      if (now - lastDarkAtRef.current < DARK_PROMPT_MS) return;
      lastDarkAtRef.current = now;
      lastCueAtRef.current = now;
      speechQueue.speak(cueSpeech(cue));
      return;
    }

    if (cue === "no-object") {
      if (objectMissingSinceRef.current === null) {
        objectMissingSinceRef.current = now;
      }
      // Silence is better than nagging while the user is still getting set up.
      if (now - objectMissingSinceRef.current < NO_OBJECT_PROMPT_MS) return;
      if (now - lastNoObjectAtRef.current < NO_OBJECT_PROMPT_MS) return;
      lastNoObjectAtRef.current = now;
      lastCueAtRef.current = now;
      speechQueue.speak(cueSpeech(cue));
      return;
    }

    objectMissingSinceRef.current = null;
    if (now - lastCueAtRef.current < CUE_INTERVAL_MS) return;
    lastCueAtRef.current = now;
    speechQueue.speak(cueSpeech(cue));
  }

  function startCountdown() {
    cancelFrameLoop();
    changePhase("countdown");
    setStatus("Item centered. Capturing in 3");
    setCountdown(3);

    // Chaining on each utterance keeps the digits on screen in step with the
    // voice, however fast the user has set the speech rate.
    speechQueue.speak("Item centered. Capturing in 3.", {
      interrupt: true,
      onDone: () => setCountdown(2),
    });
    speechQueue.speak("2.", { onDone: () => setCountdown(1) });
    speechQueue.speak("1.", { onDone: capturePhoto });
  }

  async function capturePhoto() {
    if (!isMountedRef.current || phaseRef.current !== "countdown") return;

    const camera = cameraRef.current;
    if (!camera) {
      failWith("Capture failed.");
      return;
    }

    changePhase("capturing");
    setCountdown(null);
    setStatus("Capturing");

    try {
      const photo = await camera.takePictureAsync({
        quality: 0.8,
        shutterSound: false,
        exif: false,
      });
      if (!photo?.uri) throw new Error("No photo");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      await classifyPhoto(photo.uri);
    } catch {
      failWith("Capture failed.");
    }
  }

  async function classifyPhoto(uri: string) {
    changePhase("analyzing");
    setStatus("Analyzing. This may take a few seconds.");
    speechQueue.speak("Analyzing. This may take a few seconds.", {
      interrupt: true,
    });

    try {
      const response = await classifyWasteImage({ uri });
      if (!isMountedRef.current) return;

      const entry = createClassificationEntry(response, uri);
      appendClassification(entry).catch(() => undefined);

      setResult({ response, entry });
      changePhase("result");
      announceResult(response);
    } catch {
      if (!isMountedRef.current) return;
      failWith("Classification failed.");
    }
  }

  function announceResult(response: SegregationResponse) {
    const confidence = Math.round(response.confidencePercent);
    const instruction = response.instruction?.trim().replace(/\.$/, "") ?? "";
    const verdict = `This item is ${response.segregation}. ${instruction}. Confidence ${confidence} percent.`;

    setStatus(verdict);
    speechQueue.speakSequence([verdict, actionPrompt()], startListening);
  }

  function actionPrompt(): string {
    if (canUseVoice) {
      return "Say 'again' to classify another item. Say 'ask' to ask a follow-up question. Say 'exit' to leave guided mode.";
    }
    return "Use the buttons on screen. Again classifies another item, Ask opens a follow-up question, Exit leaves guided mode.";
  }

  function failWith(message: string) {
    cancelFrameLoop();
    changePhase("failed");
    setCountdown(null);
    setStatus(message);

    const prompt = canUseVoice
      ? "Say 'retry' or 'exit'."
      : "Tap Retry to try again, or Exit to leave guided mode.";
    speechQueue.speakSequence([`${message} ${prompt}`], startListening);
  }

  function startListening() {
    const recognizer = recognizerRef.current;
    if (!recognizer) return;

    recognizer
      .start(
        { locale: localeFor(settings.voiceLanguage) },
        {
          onResult: (transcript) => {
            const command = parseVoiceCommand(transcript);
            if (command) handleVoiceCommand(command);
            else {
              speechQueue.speak("Sorry, I did not catch that.", {
                interrupt: true,
              });
            }
          },
        },
      )
      .catch(() => undefined);
  }

  function stopListening() {
    recognizerRef.current?.stop().catch(() => undefined);
  }

  function handleVoiceCommand(command: VoiceCommand) {
    if (command === "exit") {
      exitGuidedMode();
      return;
    }
    if (command === "ask") {
      openFollowUpChat();
      return;
    }
    restartGuidance();
  }

  function restartGuidance() {
    stopListening();
    stabilityRef.current.reset();
    shakeRef.current.reset();
    objectMissingSinceRef.current = null;
    lastCueAtRef.current = 0;
    lastDarkAtRef.current = 0;
    lastNoObjectAtRef.current = 0;

    setResult(null);
    setCountdown(null);
    setStatus("Point the camera at the next item");
    changePhase("guiding");
    speechQueue.speak("Ready. Point the camera at the next item.", {
      interrupt: true,
    });
    scheduleNextFrame(600);
  }

  function openFollowUpChat() {
    if (!result) {
      speechQueue.speak("There is no result to ask about yet.", {
        interrupt: true,
      });
      return;
    }
    cancelFrameLoop();
    stopListening();
    speechQueue.stop();
    navigation.navigate("Chat", { classification: result.entry });
  }

  function exitGuidedMode() {
    cancelFrameLoop();
    stopListening();
    speechQueue.stop();
    navigation.goBack();
  }

  function useGalleryInstead() {
    speechQueue.stop();
    navigation.navigate("Home", { pendingCapture: "library" });
  }

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cancelFrameLoop();
      speechQueue.stop();
      recognizerRef.current?.stop().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    speechQueue.setRate(settings.speechRate);
  }, [settings.speechRate]);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  // Guidance leans on shake detection, so the sensor runs for the whole screen
  // rather than being started and stopped with each phase.
  useEffect(() => {
    Accelerometer.setUpdateInterval(120);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      shakeRef.current.push(x, y, z);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!permission?.granted || !isCameraReady) return;
    if (phaseRef.current !== "starting") return;

    changePhase("guiding");
    setStatus("Hold your phone about one foot from the item");
    speechQueue.speak(INTRO, { interrupt: true });
    scheduleNextFrame(600);
    // Runs once, when the camera is both permitted and ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, isCameraReady]);

  useEffect(() => {
    if (!permission || permission.granted || permission.canAskAgain) return;
    speechQueue.speak(
      "Camera access is turned off, so guided mode cannot see. Use the button on screen to choose a photo from your library instead.",
      { interrupt: true },
    );
  }, [permission]);

  // Leaving for the chat screen must not leave the camera sampling or the
  // voice talking underneath it.
  useEffect(
    () =>
      navigation.addListener("blur", () => {
        cancelFrameLoop();
        speechQueue.stop();
        stopListening();
      }),
    [navigation],
  );

  useEffect(() => {
    if (reduceMotion || phase !== "guiding") {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.4, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reduceMotion, phase, pulse]);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Feather name="camera-off" size={44} color={theme.colors.text} />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          Guided mode uses the camera to tell you how to aim. Without it you can
          still classify a photo from your library.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Allow camera access"
          accessibilityHint="Opens the system prompt for camera permission"
        >
          <Text style={styles.primaryButtonText}>Allow camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={useGalleryInstead}
          accessibilityRole="button"
          accessibilityLabel="Choose a photo from your library instead"
          accessibilityHint="Leaves guided mode and opens your photo library"
        >
          <Text style={styles.secondaryButtonText}>Choose a photo instead</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.stopButton}
          onPress={exitGuidedMode}
          accessibilityRole="button"
          accessibilityLabel="Stop guided mode"
        >
          <Text style={styles.stopButtonText}>STOP</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBusy = phase === "capturing" || phase === "analyzing";
  const showGuideBox = phase === "guiding" || phase === "countdown";
  const showActions = phase === "result" || phase === "failed";
  const isRecyclable = result?.entry.segregation === "recyclable";

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus="on"
        animateShutter={false}
        onCameraReady={() => {
          isCameraReadyRef.current = true;
          setIsCameraReady(true);
        }}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.scrim, styles.topScrim, { paddingTop: insets.top + 12 }]}>
          <Text
            style={styles.statusText}
            accessibilityLiveRegion="assertive"
            accessibilityRole="text"
            maxFontSizeMultiplier={1.6}
          >
            {status}
          </Text>
          {countdown !== null && (
            <Text style={styles.countdownText} maxFontSizeMultiplier={1.4}>
              {countdown}
            </Text>
          )}
          {isBusy && <ActivityIndicator color="#ffffff" style={styles.busySpinner} />}
        </View>

        {/* Collapsed once a result is in, so the card and buttons below get
            the room they need at large text sizes. */}
        <View style={[styles.guideRow, { height: showGuideBox ? guideSize : 0 }]}>
          <View style={styles.scrim} />
          <Animated.View
            style={[
              styles.guideBox,
              { width: guideSize, height: showGuideBox ? guideSize : 0 },
              showGuideBox ? pulseStyle : styles.guideBoxHidden,
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </Animated.View>
          <View style={styles.scrim} />
        </View>

        <View
          style={[
            styles.scrim,
            styles.bottomScrim,
            { paddingBottom: insets.bottom + 12 },
          ]}
        >
          {result && (
            <View
              style={[
                styles.resultCard,
                isRecyclable ? styles.recyclableCard : styles.trashCard,
              ]}
            >
              <Text style={styles.resultTitle} maxFontSizeMultiplier={1.5}>
                {result.response.segregation}
              </Text>
              <Text style={styles.resultBody} maxFontSizeMultiplier={1.5}>
                {result.response.instruction}
              </Text>
              <Text style={styles.resultConfidence} maxFontSizeMultiplier={1.5}>
                {Math.round(result.entry.confidencePercent)}% confidence
              </Text>
            </View>
          )}

          {showActions && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={restartGuidance}
                accessibilityRole="button"
                accessibilityLabel={
                  phase === "failed" ? "Retry" : "Classify another item"
                }
                accessibilityHint="Restarts camera guidance from the beginning"
              >
                <Feather name="refresh-cw" size={24} color={theme.colors.text} />
                <Text style={styles.actionText}>
                  {phase === "failed" ? "Retry" : "Again"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, !result && styles.actionButtonDisabled]}
                onPress={openFollowUpChat}
                disabled={!result}
                accessibilityRole="button"
                accessibilityLabel="Ask a follow-up question"
                accessibilityHint="Opens the AI chat about this result"
                accessibilityState={{ disabled: !result }}
              >
                <Feather
                  name="message-circle"
                  size={24}
                  color={theme.colors.text}
                />
                <Text style={styles.actionText}>Ask</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={exitGuidedMode}
                accessibilityRole="button"
                accessibilityLabel="Exit guided mode"
                accessibilityHint="Returns to the home screen"
              >
                <Feather name="log-out" size={24} color={theme.colors.text} />
                <Text style={styles.actionText}>Exit</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.stopButton, styles.stopButtonFloating]}
            onPress={exitGuidedMode}
            accessibilityRole="button"
            accessibilityLabel="Stop guided mode"
            accessibilityHint="Stops all speech and returns to the home screen"
          >
            <Text style={styles.stopButtonText} maxFontSizeMultiplier={1.4}>
              STOP
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  const { colors } = theme;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: "#000000",
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      backgroundColor: colors.background,
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
      backgroundColor: colors.overlay,
    },
    topScrim: {
      alignItems: "center",
      justifyContent: "flex-start",
      paddingHorizontal: 20,
    },
    bottomScrim: {
      alignItems: "stretch",
      justifyContent: "flex-end",
      paddingHorizontal: 16,
      gap: 12,
    },
    statusText: {
      color: "#ffffff",
      fontSize: 26,
      lineHeight: 32,
      fontWeight: "800",
      textAlign: "center",
    },
    countdownText: {
      color: "#ffffff",
      fontSize: 64,
      fontWeight: "900",
      marginTop: 4,
    },
    busySpinner: {
      marginTop: 12,
    },
    guideRow: {
      flexDirection: "row",
    },
    guideBox: {
      overflow: "hidden",
    },
    guideBoxHidden: {
      opacity: 0,
    },
    corner: {
      position: "absolute",
      width: 38,
      height: 38,
      borderColor: colors.guide,
    },
    cornerTopLeft: {
      top: 0,
      left: 0,
      borderTopWidth: 5,
      borderLeftWidth: 5,
      borderTopLeftRadius: 12,
    },
    cornerTopRight: {
      top: 0,
      right: 0,
      borderTopWidth: 5,
      borderRightWidth: 5,
      borderTopRightRadius: 12,
    },
    cornerBottomLeft: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 5,
      borderLeftWidth: 5,
      borderBottomLeftRadius: 12,
    },
    cornerBottomRight: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 5,
      borderRightWidth: 5,
      borderBottomRightRadius: 12,
    },
    resultCard: {
      borderRadius: 20,
      padding: 16,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    recyclableCard: {
      backgroundColor: colors.recyclableSurface,
    },
    trashCard: {
      backgroundColor: colors.trashSurface,
    },
    resultTitle: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      textTransform: "capitalize",
    },
    resultBody: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      marginTop: 4,
    },
    resultConfidence: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "700",
      marginTop: 8,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
    },
    actionButton: {
      flex: 1,
      minWidth: 80,
      minHeight: 80,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
    },
    actionButtonDisabled: {
      opacity: 0.45,
    },
    actionText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    stopButton: {
      alignSelf: "stretch",
      minHeight: 72,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: colors.danger,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
      marginTop: 12,
    },
    stopButtonFloating: {
      marginTop: 4,
    },
    stopButtonText: {
      color: "#ffffff",
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: 2,
    },
    permissionTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "800",
      marginTop: 16,
      textAlign: "center",
    },
    permissionBody: {
      color: colors.textMuted,
      fontSize: 16,
      lineHeight: 22,
      textAlign: "center",
      marginTop: 10,
    },
    primaryButton: {
      alignSelf: "stretch",
      minHeight: 60,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: colors.accent,
      marginTop: 24,
    },
    primaryButtonText: {
      color: colors.onAccent,
      fontSize: 17,
      fontWeight: "800",
    },
    secondaryButton: {
      alignSelf: "stretch",
      minHeight: 60,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: theme.borderWidth,
      borderColor: colors.border,
      marginTop: 12,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "800",
    },
  });
}
