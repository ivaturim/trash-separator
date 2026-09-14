import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import { classifyWasteImage } from "../api/trashApi";
import { useVoiceCommand } from "../hooks/useVoiceCommand";
import { useVoiceModeSettings } from "../hooks/useVoiceModeSettings";
import { formatEntryTimestamp } from "../lib/formatDate";
import {
  appendClassification,
  createClassificationEntry,
  loadClassifications,
  type ClassificationEntry,
} from "../lib/historyStore";
import { summarizeImpact } from "../lib/impactCalculator";
import {
  parseIntent,
  parseYesNo,
  type Intent,
} from "../lib/intentParser";
import {
  buildSystemPrompt,
  requestAssistantReply,
  type ChatMessage,
} from "../lib/openaiClient";
import { speechQueue } from "../lib/speechQueue";
import { isVoiceInputAvailable } from "../lib/voiceCommands";
import { phrasesFor } from "../lib/voicePhrases";
import {
  INITIAL_CONTEXT,
  isActive,
  voiceReducer,
  type ListenTopic,
  type VoiceContext,
} from "../lib/voiceMachine";
import { navigate } from "../navigation/ref";
import { loadConversation, saveConversation } from "../storage/chat";

export type OverlayLayout = "full" | "compact";

export type VoiceModeValue = {
  context: VoiceContext;
  layout: OverlayLayout;
  permissionDenied: boolean;
  isAvailable: boolean;
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
  interrupt: () => void;
  submitTranscript: (transcript: string) => void;
  setLayout: (layout: OverlayLayout) => void;
  dismissPermission: () => void;
};

const VoiceModeContext = createContext<VoiceModeValue | null>(null);

type SelectedImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

function hapticSelect() {
  Haptics.selectionAsync().catch(() => undefined);
}

function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
    () => undefined,
  );
}

function looksOffline(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("network") ||
    message.includes("internet") ||
    message.includes("failed to fetch") ||
    message.includes("network request failed")
  );
}

function createChatMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function VoiceModeProvider({ children }: { children: ReactNode }) {
  const settings = useVoiceModeSettings();
  const phrases = phrasesFor(settings.language);

  const [context, dispatch] = useReducer(voiceReducer, INITIAL_CONTEXT);
  const contextRef = useRef(context);
  contextRef.current = context;

  const layoutRef = useRef<OverlayLayout>("full");
  const [layout, setLayoutState] = useReducer(
    (_: OverlayLayout, next: OverlayLayout) => {
      layoutRef.current = next;
      return next;
    },
    "full" as OverlayLayout,
  );

  const permissionDeniedRef = useRef(false);
  const [permissionDenied, setPermissionDenied] = useReducer(
    (_: boolean, next: boolean) => {
      permissionDeniedRef.current = next;
      return next;
    },
    false,
  );

  /**
   * Bumped on every deactivate so in-flight pickers, API calls, and speech
   * callbacks cannot restart listening after the user has already left.
   */
  const generationRef = useRef(0);
  const lastImageRef = useRef<SelectedImage | null>(null);
  const lastClassificationRef = useRef<ClassificationEntry | null>(null);
  const justClassifiedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const submitRef = useRef<(transcript: string) => void>(() => undefined);
  const speakListenRef = useRef<(text: string, topic: ListenTopic) => void>(
    () => undefined,
  );

  const voice = useVoiceCommand({
    locale: settings.locale,
    onPartial: (transcript) => {
      // Barge-in: any real speech while we are talking cuts the line off.
      // TTS itself is not a reliable VAD, so this only fires when a recogniser
      // is registered (development builds). The FAB remains the Expo Go path.
      if (contextRef.current.state === "speaking" && transcript.trim()) {
        speechQueue.stop();
        dispatch({ type: "LISTEN", topic: contextRef.current.topic });
      }
      dispatch({ type: "PARTIAL", transcript });
    },
    onResult: (transcript) => {
      submitRef.current(transcript);
    },
    onSilence: () => {
      if (!isActive(contextRef.current)) return;
      speakListenRef.current(phrases.didNotHear, "command");
    },
    onError: (message) => {
      if (message === "microphone-denied") {
        setPermissionDenied(true);
        return;
      }
      if (!isActive(contextRef.current)) return;
      speakListenRef.current(phrases.notUnderstood, "command");
    },
  });

  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  function stillCurrent(generation: number): boolean {
    return generation === generationRef.current && isActive(contextRef.current);
  }

  const setLayout = useCallback((next: OverlayLayout) => {
    setLayoutState(next);
  }, []);

  const speakThenListen = useCallback((text: string, topic: ListenTopic) => {
    const generation = generationRef.current;
    dispatch({ type: "SPEAK", caption: text });
    speechQueue.speak(text, {
      interrupt: true,
      onDone: () => {
        if (!stillCurrent(generation)) return;
        dispatch({ type: "LISTEN", topic });
      },
    });
  }, []);

  speakListenRef.current = speakThenListen;

  const speakThen = useCallback((text: string, then: () => void) => {
    const generation = generationRef.current;
    dispatch({ type: "SPEAK", caption: text });
    speechQueue.speak(text, {
      interrupt: true,
      onDone: () => {
        if (!stillCurrent(generation)) return;
        then();
      },
    });
  }, []);

  const startListening = useCallback(async (topic: ListenTopic) => {
    hapticLight();
    await speechQueue.stop();
    dispatch({ type: "LISTEN", topic });
  }, []);

  useEffect(() => {
    if (context.state !== "listening") return;
    if (!voice.isAvailable || voice.isListening) return;
    voice.listen();
  }, [context.state, voice.isAvailable, voice.isListening, voice.listen]);

  const deactivate = useCallback(() => {
    generationRef.current += 1;
    justClassifiedRef.current = false;
    voiceRef.current.stop();
    speechQueue.stop();
    dispatch({ type: "DEACTIVATE" });
    setLayoutState("full");
  }, []);

  const activate = useCallback(() => {
    generationRef.current += 1;
    setLayoutState("full");
    setPermissionDenied(false);
    dispatch({ type: "ACTIVATE" });
    speechQueue.setRate(settings.speechRate);
    speechQueue.setLanguage(settings.locale);
    hapticLight();
    speakThenListen(phrases.activated, "command");
  }, [phrases.activated, settings.locale, settings.speechRate, speakThenListen]);

  const toggle = useCallback(() => {
    if (isActive(contextRef.current)) deactivate();
    else activate();
  }, [activate, deactivate]);

  const interrupt = useCallback(() => {
    if (!isActive(contextRef.current)) {
      activate();
      return;
    }
    voiceRef.current.stop();
    speechQueue.stop();
    startListening(contextRef.current.topic);
  }, [activate, startListening]);

  async function resolveClassification(
    id: string | null,
  ): Promise<ClassificationEntry | null> {
    if (lastClassificationRef.current?.id === id && lastClassificationRef.current) {
      return lastClassificationRef.current;
    }
    const history = await loadClassifications().catch(() => []);
    if (id) {
      const match = history.find((entry) => entry.id === id);
      if (match) {
        lastClassificationRef.current = match;
        return match;
      }
    }
    return history[0] ?? lastClassificationRef.current;
  }

  async function classifyImage(image: SelectedImage) {
    const generation = generationRef.current;
    lastImageRef.current = image;
    dispatch({ type: "THINKING" });
    dispatch({ type: "SPEAK", caption: phrases.analyzing });
    speechQueue.speak(phrases.analyzing, { interrupt: true });

    try {
      const response = await classifyWasteImage(image);
      if (!stillCurrent(generation)) return;

      const entry = createClassificationEntry(response, image.uri);
      lastClassificationRef.current = entry;
      justClassifiedRef.current = true;
      dispatch({ type: "CLASSIFIED", classificationId: entry.id });
      appendClassification(entry).catch(() => undefined);

      const spoken = phrases.result({
        segregation: phrases.segregationWord(response.segregation),
        instruction: response.instruction?.trim().replace(/\.$/, "") ?? "",
        confidencePercent: Math.round(response.confidencePercent),
      });
      hapticSelect();
      speakThenListen(spoken, "command");
    } catch (error) {
      if (!stillCurrent(generation)) return;
      hapticError();
      dispatch({
        type: "ERROR",
        message: looksOffline(error)
          ? phrases.offline
          : phrases.classificationFailed,
      });
      speakThenListen(
        looksOffline(error) ? phrases.offline : phrases.classificationFailed,
        looksOffline(error) ? "command" : "confirm-retry",
      );
    }
  }

  async function captureFrom(source: "camera" | "library") {
    const generation = generationRef.current;
    await voiceRef.current.stop();

    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!stillCurrent(generation)) return;
    if (!permission.granted) {
      speakThenListen(phrases.classificationFailed, "command");
      return;
    }

    const photo =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

    if (!stillCurrent(generation)) return;
    if (photo.canceled) {
      speakThenListen(phrases.cancelled, "command");
      return;
    }

    await classifyImage(photo.assets[0]);
  }

  async function handleAsk() {
    const generation = generationRef.current;
    const entry = await resolveClassification(contextRef.current.classificationId);
    if (!stillCurrent(generation)) return;

    if (!entry) {
      speakThenListen(phrases.nothingClassified, "command");
      return;
    }

    lastClassificationRef.current = entry;
    dispatch({ type: "CLASSIFIED", classificationId: entry.id });
    setLayoutState("compact");
    navigate("Chat", { classification: entry });
    speakThenListen(phrases.askPrompt, "question");
  }

  async function handleQuestion(transcript: string) {
    const generation = generationRef.current;
    const entry = await resolveClassification(contextRef.current.classificationId);
    if (!stillCurrent(generation)) return;

    if (!entry) {
      speakThenListen(phrases.nothingClassified, "command");
      return;
    }

    dispatch({ type: "THINKING" });

    try {
      const history = await loadConversation(entry.id);
      const userMessage = createChatMessage("user", transcript);
      const nextHistory = [...history, userMessage];
      const reply = await requestAssistantReply(
        buildSystemPrompt(entry.segregation, entry.confidencePercent),
        nextHistory,
      );
      if (!stillCurrent(generation)) return;

      const assistantMessage = createChatMessage("assistant", reply);
      await saveConversation(entry.id, [...nextHistory, assistantMessage]);

      speakThen(reply, () => {
        speakThenListen(phrases.askAnother, "confirm-question");
      });
    } catch (error) {
      if (!stillCurrent(generation)) return;
      hapticError();
      speakThenListen(
        looksOffline(error) ? phrases.offline : phrases.classificationFailed,
        "confirm-question",
      );
    }
  }

  async function handleHistory() {
    const generation = generationRef.current;
    setLayoutState("compact");
    navigate("Home");

    const history = await loadClassifications().catch(() => []);
    if (!stillCurrent(generation)) return;

    const recent = history.slice(0, 3);
    if (recent.length === 0) {
      speakThenListen(phrases.historyEmpty, "command");
      return;
    }

    const lines = [
      phrases.historyIntro(recent.length),
      ...recent.map((entry, index) =>
        phrases.historyItem(index + 1, {
          segregation: phrases.segregationWord(entry.segregation),
          detail:
            entry.type === "barcode"
              ? (entry.label ?? "barcode")
              : formatEntryTimestamp(entry.timestamp),
        }),
      ),
    ];

    dispatch({ type: "SPEAK", caption: lines.join(" ") });
    speechQueue.speakSequence(lines, () => {
      if (!stillCurrent(generation)) return;
      dispatch({ type: "LISTEN", topic: "command" });
    });
  }

  async function handleImpact() {
    const generation = generationRef.current;
    setLayoutState("compact");
    navigate("Impact");

    const history = await loadClassifications().catch(() => []);
    if (!stillCurrent(generation)) return;

    if (history.length === 0) {
      speakThenListen(phrases.impactEmpty, "command");
      return;
    }

    const summary = summarizeImpact(history);
    speakThenListen(
      phrases.impactSummary({
        totalItems: summary.totalItems,
        recycledItems: summary.recycledItems,
        co2SavedKg: summary.co2SavedKg,
      }),
      "command",
    );
  }

  async function runIntent(intent: Intent) {
    switch (intent) {
      case "STOP":
        speakThen(phrases.stopped, deactivate);
        return;
      case "HELP":
        speakThenListen(phrases.help, "command");
        return;
      case "TAKE_PHOTO":
        setLayoutState("full");
        justClassifiedRef.current = false;
        speakThen(phrases.openingCamera, () => {
          captureFrom("camera");
        });
        return;
      case "CHOOSE_PHOTO":
        setLayoutState("full");
        justClassifiedRef.current = false;
        speakThen(phrases.openingGallery, () => {
          captureFrom("library");
        });
        return;
      case "HISTORY":
        await handleHistory();
        return;
      case "IMPACT":
        await handleImpact();
        return;
      case "ASK":
        justClassifiedRef.current = false;
        await handleAsk();
        return;
      default:
        speakThenListen(phrases.notUnderstood, "command");
    }
  }

  const submitTranscript = useCallback(
    async (raw: string) => {
      const transcript = raw.trim();
      if (!transcript || !isActive(contextRef.current)) return;

      const generation = generationRef.current;
      await voiceRef.current.stop();
      dispatch({ type: "HEARD", transcript });

      const topic = contextRef.current.topic;

      if (topic === "question") {
        hapticSelect();
        await handleQuestion(transcript);
        return;
      }

      if (topic === "confirm-question") {
        const answer = parseYesNo(transcript, settings.language);
        if (answer === "yes") {
          hapticSelect();
          await handleAsk();
          return;
        }
        if (answer === "no") {
          hapticSelect();
          justClassifiedRef.current = false;
          speakThenListen(phrases.activated, "command");
          return;
        }
      }

      if (topic === "confirm-retry") {
        const answer = parseYesNo(transcript, settings.language);
        if (answer === "yes" && lastImageRef.current) {
          hapticSelect();
          await classifyImage(lastImageRef.current);
          return;
        }
        if (answer === "no") {
          hapticSelect();
          speakThenListen(phrases.activated, "command");
          return;
        }
      }

      // After a result the prompt offers a follow-up; "yes" means ask.
      if (justClassifiedRef.current) {
        const answer = parseYesNo(transcript, settings.language);
        if (answer === "yes") {
          hapticSelect();
          justClassifiedRef.current = false;
          await handleAsk();
          return;
        }
        if (answer === "no") {
          justClassifiedRef.current = false;
        }
      }

      const parsed = await parseIntent(transcript, {
        language: settings.language,
        allowRemote: true,
      });
      if (!stillCurrent(generation)) return;

      dispatch({
        type: "INTENT",
        intent: parsed.intent,
        source: parsed.source,
      });

      if (parsed.intent === "UNKNOWN") {
        hapticError();
        speakThenListen(phrases.notUnderstood, "command");
        return;
      }

      hapticSelect();
      await runIntent(parsed.intent);
    },
    [phrases, settings.language, speakThenListen],
  );

  submitRef.current = submitTranscript;

  useEffect(() => {
    speechQueue.setRate(settings.speechRate);
    speechQueue.setLanguage(settings.locale);
  }, [settings.locale, settings.speechRate]);

  useEffect(() => {
    if (!settings.ready || autoStartedRef.current) return;
    if (!settings.autoListen) return;
    autoStartedRef.current = true;
    activate();
  }, [activate, settings.autoListen, settings.ready]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      speechQueue.stop();
    };
  }, []);

  const value = useMemo<VoiceModeValue>(
    () => ({
      context,
      layout,
      permissionDenied,
      isAvailable: isVoiceInputAvailable(),
      activate,
      deactivate,
      toggle,
      interrupt,
      submitTranscript,
      setLayout,
      dismissPermission: () => setPermissionDenied(false),
    }),
    [
      activate,
      context,
      deactivate,
      interrupt,
      layout,
      permissionDenied,
      setLayout,
      submitTranscript,
      toggle,
    ],
  );

  return (
    <VoiceModeContext.Provider value={value}>{children}</VoiceModeContext.Provider>
  );
}

export function useVoiceMode(): VoiceModeValue {
  const value = useContext(VoiceModeContext);
  if (!value) {
    throw new Error("useVoiceMode must be used inside a VoiceModeProvider");
  }
  return value;
}
