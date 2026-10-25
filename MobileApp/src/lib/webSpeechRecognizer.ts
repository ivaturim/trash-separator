import { Platform } from "react-native";

import {
  registerSpeechRecognizer,
  type SpeechRecognizer,
  type SpeechRecognizerHandlers,
} from "./voiceCommands";

/**
 * On the website, Voice Mode and Guided Mode listen through the browser's
 * built-in Web Speech API (Chrome, Edge, Safari). The phone app is unchanged:
 * it still needs a development build with expo-speech-recognition.
 */

// The Web Speech API is not in TypeScript's DOM types everywhere, so keep it loose.
type BrowserRecognition = any;

function getRecognitionClass(): (new () => BrowserRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function createWebSpeechRecognizer(): SpeechRecognizer {
  let active: BrowserRecognition | null = null;

  return {
    isAvailable: () => getRecognitionClass() !== null,

    requestPermission: async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch {
        return false;
      }
    },

    start: async ({ locale }, handlers: SpeechRecognizerHandlers) => {
      const Recognition = getRecognitionClass();
      if (!Recognition) throw new Error("Speech recognition is not supported.");

      if (active) {
        try {
          active.abort();
        } catch {
          // already stopped
        }
      }

      const recognition = new Recognition();
      recognition.lang = locale;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      let delivered = false;

      recognition.onresult = (event: any) => {
        let transcript = "";
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }
        if (isFinal) {
          if (delivered) return;
          delivered = true;
          handlers.onResult(transcript.trim());
        } else {
          handlers.onPartial?.(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        const code: string = event?.error ?? "recognition-failed";
        // "no-speech" is handled by the caller's silence timer; "aborted" is ours.
        if (code === "no-speech" || code === "aborted") return;
        if (code === "not-allowed" || code === "service-not-allowed") {
          handlers.onError?.("microphone-denied");
          return;
        }
        handlers.onError?.(code);
      };

      recognition.onend = () => {
        if (active === recognition) active = null;
        handlers.onEnd?.();
      };

      active = recognition;
      recognition.start();
    },

    stop: async () => {
      const recognition = active;
      active = null;
      if (!recognition) return;
      try {
        recognition.abort();
      } catch {
        // already stopped
      }
    },
  };
}

if (Platform.OS === "web" && getRecognitionClass() !== null) {
  registerSpeechRecognizer(createWebSpeechRecognizer());
}