export type VoiceCommand = "again" | "ask" | "exit" | "retry";

/** Each command accepts the words people actually say for it. */
const SYNONYMS: { command: VoiceCommand; phrases: string[] }[] = [
  // "try again" contains "again", so retry has to be matched first.
  { command: "retry", phrases: ["retry", "try again", "one more time"] },
  { command: "exit", phrases: ["exit", "quit", "stop", "leave", "cancel", "done"] },
  { command: "ask", phrases: ["ask", "question", "follow up", "chat", "tell me more"] },
  { command: "again", phrases: ["again", "another", "next", "repeat", "more"] },
];

function normalize(transcript: string): string {
  return ` ${transcript.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

/**
 * Recognisers return whole sentences ("okay, let's do another one"), so each
 * phrase is matched on word boundaries anywhere in the transcript.
 */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const haystack = normalize(transcript);
  if (haystack.trim().length === 0) return null;

  for (const { command, phrases } of SYNONYMS) {
    for (const phrase of phrases) {
      if (haystack.includes(` ${phrase} `)) return command;
    }
  }

  return null;
}

export type SpeechRecognizerHandlers = {
  /** Interim results, used for the live transcript and to interrupt speech. */
  onPartial?: (transcript: string) => void;
  onResult: (transcript: string) => void;
  onError?: (message: string) => void;
  /** Fires when the recogniser stops on its own, for example after silence. */
  onEnd?: () => void;
};

export type SpeechRecognizer = {
  /** False when the microphone or the recogniser itself is unavailable. */
  isAvailable: () => boolean;
  requestPermission: () => Promise<boolean>;
  start: (
    options: { locale: string },
    handlers: SpeechRecognizerHandlers,
  ) => Promise<void>;
  stop: () => Promise<void>;
};

let registered: SpeechRecognizer | null = null;

/**
 * Speech recognition needs a native module that Expo Go does not bundle, so
 * Guided Mode and Voice Mode both ship with on-screen equivalents for every
 * spoken command and stay fully usable without it. To switch listening on in
 * a development build:
 *
 *   1. `npx expo install expo-speech-recognition`
 *   2. add `expo-speech-recognition` to the plugins array in `app.json`
 *   3. build with `npx expo run:ios` (Expo Go cannot load it)
 *   4. call `registerSpeechRecognizer(...)` from `App.tsx` before render,
 *      wrapping `ExpoSpeechRecognitionModule.start({ lang, interimResults:
 *      true, continuous: true })` and forwarding its `result` events to
 *      `onPartial` and `onResult`.
 *
 * Both screens pick the recogniser up automatically once it is registered.
 */
export function registerSpeechRecognizer(recognizer: SpeechRecognizer) {
  registered = recognizer;
}

export function getSpeechRecognizer(): SpeechRecognizer | null {
  if (!registered) return null;
  return registered.isAvailable() ? registered : null;
}

export function isVoiceInputAvailable(): boolean {
  return getSpeechRecognizer() !== null;
}
