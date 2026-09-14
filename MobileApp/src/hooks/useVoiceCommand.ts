import { useCallback, useEffect, useRef, useState } from "react";

import {
  getSpeechRecognizer,
  type SpeechRecognizer,
} from "../lib/voiceCommands";

const SILENCE_TIMEOUT_MS = 3000;

export type UseVoiceCommandOptions = {
  /** BCP-47 tag, for example "hi-IN". */
  locale: string;
  onPartial?: (transcript: string) => void;
  onResult: (transcript: string) => void;
  /** No speech at all within the silence window. */
  onSilence?: () => void;
  onError?: (message: string) => void;
};

export type UseVoiceCommand = {
  /** False in Expo Go, where no recogniser is registered. */
  isAvailable: boolean;
  isListening: boolean;
  listen: () => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * Owns the recogniser's lifecycle for one screen: starts a turn, gives up
 * after a few seconds of silence, and guarantees the microphone is released
 * when the caller unmounts.
 */
export function useVoiceCommand(
  options: UseVoiceCommandOptions,
): UseVoiceCommand {
  const recognizerRef = useRef<SpeechRecognizer | null>(getSpeechRecognizer());
  const [isListening, setIsListening] = useState(false);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heardAnythingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Handlers are read through a ref so a turn in flight always calls the
  // latest callbacks without needing to restart the recogniser.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(async () => {
    clearSilenceTimer();
    setIsListening(false);
    await recognizerRef.current?.stop().catch(() => undefined);
  }, [clearSilenceTimer]);

  const listen = useCallback(async () => {
    const recognizer = recognizerRef.current;
    if (!recognizer) return;

    clearSilenceTimer();
    heardAnythingRef.current = false;

    const granted = await recognizer.requestPermission().catch(() => false);
    if (!granted) {
      optionsRef.current.onError?.("microphone-denied");
      return;
    }

    setIsListening(true);

    silenceTimerRef.current = setTimeout(() => {
      if (heardAnythingRef.current) return;
      stop();
      optionsRef.current.onSilence?.();
    }, SILENCE_TIMEOUT_MS);

    try {
      await recognizer.start(
        { locale: optionsRef.current.locale },
        {
          onPartial: (transcript) => {
            if (!isMountedRef.current) return;
            if (transcript.trim().length > 0) heardAnythingRef.current = true;
            optionsRef.current.onPartial?.(transcript);
          },
          onResult: (transcript) => {
            if (!isMountedRef.current) return;
            heardAnythingRef.current = true;
            clearSilenceTimer();
            setIsListening(false);
            optionsRef.current.onResult(transcript);
          },
          onError: (message) => {
            if (!isMountedRef.current) return;
            clearSilenceTimer();
            setIsListening(false);
            optionsRef.current.onError?.(message);
          },
          onEnd: () => {
            if (!isMountedRef.current) return;
            setIsListening(false);
          },
        },
      );
    } catch {
      clearSilenceTimer();
      setIsListening(false);
      optionsRef.current.onError?.("recognition-failed");
    }
  }, [clearSilenceTimer, stop]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearSilenceTimer();
      recognizerRef.current?.stop().catch(() => undefined);
    };
  }, [clearSilenceTimer]);

  return {
    isAvailable: recognizerRef.current !== null,
    isListening,
    listen,
    stop,
  };
}
