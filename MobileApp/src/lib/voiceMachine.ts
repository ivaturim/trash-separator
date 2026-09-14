import type { Intent, IntentSource } from "./intentParser";

/**
 * A plain reducer rather than xstate: the graph is small enough to read in one
 * screen, every side effect (recognition, speech, navigation, the API call)
 * already lives in the provider that owns the machine, and this avoids adding
 * a dependency for what amounts to one switch statement. Keeping it pure also
 * makes the transitions testable without mocking any native module.
 */
export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

/**
 * What the app is currently listening *for*. The same "listening" state means
 * different things at different points in the conversation, and the answer
 * has to be parsed accordingly.
 */
export type ListenTopic = "command" | "question" | "confirm-question" | "confirm-retry";

export type VoiceContext = {
  state: VoiceState;
  topic: ListenTopic;
  /** Live transcript while the user speaks; cleared on each new turn. */
  transcript: string;
  /** The line being spoken, shown as a subtitle. */
  caption: string | null;
  lastIntent: Intent | null;
  lastIntentSource: IntentSource | null;
  /** Classification the chat turns are attached to. */
  classificationId: string | null;
  error: string | null;
};

export const INITIAL_CONTEXT: VoiceContext = {
  state: "idle",
  topic: "command",
  transcript: "",
  caption: null,
  lastIntent: null,
  lastIntentSource: null,
  classificationId: null,
  error: null,
};

export type VoiceEvent =
  | { type: "ACTIVATE" }
  | { type: "DEACTIVATE" }
  | { type: "LISTEN"; topic: ListenTopic }
  | { type: "PARTIAL"; transcript: string }
  | { type: "HEARD"; transcript: string }
  | { type: "THINKING" }
  | { type: "SPEAK"; caption: string }
  | { type: "SPEECH_DONE" }
  | { type: "INTENT"; intent: Intent; source: IntentSource }
  | { type: "CLASSIFIED"; classificationId: string }
  | { type: "ERROR"; message: string };

export function voiceReducer(
  context: VoiceContext,
  event: VoiceEvent,
): VoiceContext {
  switch (event.type) {
    case "ACTIVATE":
      // Deliberately keeps `classificationId` so re-entering voice mode can
      // still answer questions about the last item.
      return {
        ...context,
        state: "speaking",
        topic: "command",
        transcript: "",
        error: null,
      };

    case "DEACTIVATE":
      return { ...INITIAL_CONTEXT, classificationId: context.classificationId };

    case "LISTEN":
      return {
        ...context,
        state: "listening",
        topic: event.topic,
        transcript: "",
        caption: null,
        error: null,
      };

    case "PARTIAL":
      return { ...context, transcript: event.transcript };

    case "HEARD":
      return { ...context, transcript: event.transcript, state: "thinking" };

    case "THINKING":
      return { ...context, state: "thinking" };

    case "SPEAK":
      return { ...context, state: "speaking", caption: event.caption };

    case "SPEECH_DONE":
      // The provider decides what happens next; until it does, the machine
      // parks in thinking rather than pretending to listen.
      return { ...context, state: "thinking", caption: null };

    case "INTENT":
      return {
        ...context,
        lastIntent: event.intent,
        lastIntentSource: event.source,
      };

    case "CLASSIFIED":
      return { ...context, classificationId: event.classificationId };

    case "ERROR":
      return { ...context, error: event.message, state: "speaking" };

    default:
      return context;
  }
}

export function isActive(context: VoiceContext): boolean {
  return context.state !== "idle";
}
