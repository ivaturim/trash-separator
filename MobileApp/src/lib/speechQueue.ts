import * as Speech from "expo-speech";

type QueueItem = {
  text: string;
  onDone?: () => void;
};

/**
 * Rough upper bound on how long an utterance can take before we assume the
 * engine dropped it. `onDone` is not guaranteed to fire on iOS when the audio
 * session is interrupted, and the guided-mode countdown is chained off it, so
 * a stuck utterance would otherwise freeze the flow.
 */
function watchdogDelay(text: string, rate: number): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return (2000 + (words / rate) * 900) * 1.5;
}

/**
 * Speaks one utterance at a time. Callers can queue lines without checking
 * whether the engine is busy, which keeps directional cues from talking over
 * each other when a frame takes longer than usual to analyse.
 */
/** Notified with the line being spoken, or null when speech stops. */
export type SpeakingListener = (text: string | null) => void;

class SpeechQueue {
  private queue: QueueItem[] = [];
  private current: QueueItem | null = null;
  private rate = 0.95;
  private language: string | undefined;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on stop() so callbacks from cancelled utterances are ignored. */
  private generation = 0;
  /** Holds the queue while an interrupting Speech.stop() is still settling. */
  private stopping = false;
  private listeners = new Set<SpeakingListener>();

  setRate(rate: number) {
    this.rate = rate;
  }

  /** BCP-47 tag, for example "es-ES". Undefined uses the system voice. */
  setLanguage(language: string | undefined) {
    this.language = language;
  }

  get isBusy(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  /**
   * Lets the voice-mode overlay caption what is being said, so the flow is
   * followable by deaf users and anyone watching over a shoulder.
   */
  subscribe(listener: SpeakingListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(text: string | null) {
    this.listeners.forEach((listener) => listener(text));
  }

  /**
   * @param interrupt Drops anything pending and cuts off the current line.
   *   Use for state changes (countdown, results) and never for repeated cues.
   */
  speak(text: string, options: { interrupt?: boolean; onDone?: () => void } = {}) {
    const item: QueueItem = { text, onDone: options.onDone };

    if (options.interrupt) {
      this.reset();
      this.queue = [item];
      this.restartAfterStop();
      return;
    }

    this.queue.push(item);
    this.pump();
  }

  /**
   * Speech.stop() resolves only once the engine has settled, and anything
   * started before then is cancelled along with the old utterance. Lines
   * queued in the meantime therefore wait behind this.
   */
  private restartAfterStop() {
    this.stopping = true;
    const generation = this.generation;
    Speech.stop()
      .catch(() => undefined)
      .then(() => {
        // A newer interrupt has its own stop in flight and owns the queue now.
        if (generation !== this.generation) return;
        this.stopping = false;
        this.pump();
      });
  }

  /**
   * Replaces anything pending with `lines`, spoken in order. The gap the
   * engine leaves between utterances is what paces the capture countdown.
   */
  speakSequence(lines: string[], onComplete?: () => void) {
    if (lines.length === 0) {
      onComplete?.();
      return;
    }

    this.reset();
    this.queue = lines.map((text, index) => ({
      text,
      onDone: index === lines.length - 1 ? onComplete : undefined,
    }));
    this.restartAfterStop();
  }

  async stop() {
    this.reset();
    await Speech.stop().catch(() => undefined);
  }

  private reset() {
    this.generation += 1;
    this.queue = [];
    this.current = null;
    this.stopping = false;
    this.clearWatchdog();
    this.emit(null);
  }

  private clearWatchdog() {
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
  }

  private pump() {
    if (this.current || this.stopping) return;

    const next = this.queue.shift();
    if (!next) return;

    this.current = next;
    const generation = this.generation;
    this.emit(next.text);

    this.clearWatchdog();
    this.watchdog = setTimeout(
      () => this.finish(generation, next, false),
      watchdogDelay(next.text, this.rate),
    );

    Speech.speak(next.text, {
      rate: this.rate,
      language: this.language,
      onDone: () => this.finish(generation, next, false),
      onStopped: () => this.finish(generation, next, true),
      onError: () => this.finish(generation, next, true),
    });
  }

  private finish(generation: number, item: QueueItem, aborted: boolean) {
    if (generation !== this.generation) return;
    if (this.current !== item) return;

    this.clearWatchdog();
    this.current = null;
    if (this.queue.length === 0) this.emit(null);

    // A cancelled line must not run its continuation, or stopping speech
    // during a countdown would still fire the capture.
    if (!aborted) item.onDone?.();
    this.pump();
  }
}

export const speechQueue = new SpeechQueue();
