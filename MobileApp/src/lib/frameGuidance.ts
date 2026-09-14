/**
 * Heuristic framing analysis for Guided Mode.
 *
 * There is no real-time frame stream available in Expo Go, so each "frame" is
 * a downscaled still. Everything here is pure so the geometry can be tested on
 * synthetic images without a camera.
 */

export type FrameAnalysis = {
  /** Mean luminance, 0 (black) to 1 (white). */
  brightness: number;
  /** False when the frame carries too little detail to locate anything. */
  hasObject: boolean;
  /** -1 (object at left edge) to 1 (right edge), 0 at centre. */
  xOffset: number;
  /** -1 (top edge) to 1 (bottom edge), 0 at centre. */
  yOffset: number;
  /** Longest side of the object as a fraction of that side of the frame. */
  sizeRatio: number;
};

export type Cue =
  | "hold-still"
  | "dark"
  | "no-object"
  | "left"
  | "right"
  | "up"
  | "down"
  | "closer"
  | "farther"
  | "centered";

export const GUIDANCE = {
  /** Offset beyond which the item is worth nudging back towards centre. */
  offsetTolerance: 0.2,
  minSizeRatio: 0.3,
  maxSizeRatio: 0.8,
  darkBrightness: 0.18,
  /** Consecutive centred frames required before the countdown starts. */
  stableFrames: 5,
  /** The item must also stay centred for this long. */
  stableDurationMs: 2000,
};

/**
 * Below these the frame is flat (a wall, a blur) rather than an item. The
 * floors are low because an item far enough away to need "move closer" only
 * occupies a percent or so of the frame, and calling that "no item" would
 * strand the user.
 */
const MIN_MEAN_GRADIENT = 3;
const MIN_EDGE_FRACTION = 0.003;
const MIN_EDGE_MAGNITUDE = 24;

export function toGrayscale(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i += 1) {
    const offset = i * 4;
    gray[i] =
      (rgba[offset] * 299 + rgba[offset + 1] * 587 + rgba[offset + 2] * 114) /
      1000;
  }
  return gray;
}

/**
 * Locates the item as the centre of mass of edge energy, using a 3x3 Sobel
 * operator. Edges beat raw brightness here because a dark item on a light
 * floor and a light item on a dark floor both produce strong edges.
 */
export function analyzeGrayscaleFrame(
  gray: Uint8Array,
  width: number,
  height: number,
): FrameAnalysis {
  let luminanceSum = 0;
  for (let i = 0; i < gray.length; i += 1) luminanceSum += gray[i];
  const brightness = gray.length > 0 ? luminanceSum / gray.length / 255 : 0;

  const empty: FrameAnalysis = {
    brightness,
    hasObject: false,
    xOffset: 0,
    yOffset: 0,
    sizeRatio: 0,
  };

  if (width < 3 || height < 3) return empty;

  const magnitudes = new Float32Array(width * height);
  let magnitudeSum = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const topLeft = gray[(y - 1) * width + (x - 1)];
      const top = gray[(y - 1) * width + x];
      const topRight = gray[(y - 1) * width + (x + 1)];
      const left = gray[y * width + (x - 1)];
      const right = gray[y * width + (x + 1)];
      const bottomLeft = gray[(y + 1) * width + (x - 1)];
      const bottom = gray[(y + 1) * width + x];
      const bottomRight = gray[(y + 1) * width + (x + 1)];

      const gx =
        topLeft + 2 * left + bottomLeft - (topRight + 2 * right + bottomRight);
      const gy =
        topLeft + 2 * top + topRight - (bottomLeft + 2 * bottom + bottomRight);

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      magnitudes[y * width + x] = magnitude;
      magnitudeSum += magnitude;
    }
  }

  const interiorCount = (width - 2) * (height - 2);
  const meanMagnitude = magnitudeSum / interiorCount;
  if (meanMagnitude < MIN_MEAN_GRADIENT) return empty;

  // Scaling the mean keeps the threshold adaptive: a busy scene needs a
  // higher bar than a plain one before a pixel counts as the item's outline.
  const threshold = Math.max(MIN_EDGE_MAGNITUDE, meanMagnitude * 1.6);

  let weightSum = 0;
  let weightedX = 0;
  let weightedY = 0;
  let edgeCount = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const magnitude = magnitudes[y * width + x];
      if (magnitude < threshold) continue;
      weightSum += magnitude;
      weightedX += magnitude * x;
      weightedY += magnitude * y;
      edgeCount += 1;
    }
  }

  if (weightSum === 0 || edgeCount / interiorCount < MIN_EDGE_FRACTION) {
    return empty;
  }

  const centerX = weightedX / weightSum;
  const centerY = weightedY / weightSum;

  let deviationX = 0;
  let deviationY = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const magnitude = magnitudes[y * width + x];
      if (magnitude < threshold) continue;
      deviationX += magnitude * Math.abs(x - centerX);
      deviationY += magnitude * Math.abs(y - centerY);
    }
  }

  // Converting spread back to an extent depends on where the edges sit: for
  // texture spread evenly across a box of side W the mean absolute deviation
  // is W/4, while for a plain outline it is 3W/8. This constant leans towards
  // the outline case and so tends to under-read, which is the safer error:
  // it asks the user to come closer rather than backing them away from an
  // item that already fills the frame.
  const widthRatio = Math.min(1, (2.9 * (deviationX / weightSum)) / width);
  const heightRatio = Math.min(1, (2.9 * (deviationY / weightSum)) / height);

  return {
    brightness,
    hasObject: true,
    xOffset: (centerX / (width - 1) - 0.5) * 2,
    yOffset: (centerY / (height - 1) - 0.5) * 2,
    sizeRatio: Math.max(widthRatio, heightRatio),
  };
}

export function analyzeRgbaFrame(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): FrameAnalysis {
  return analyzeGrayscaleFrame(toGrayscale(rgba, width, height), width, height);
}

/**
 * Cues are ordered by how much they block a good photo: a shaking phone or a
 * dark room ruins the shot regardless of framing, and framing only matters
 * once something is actually in view.
 */
export function decideCue(
  analysis: FrameAnalysis,
  options: { isShaking?: boolean } = {},
): Cue {
  if (options.isShaking) return "hold-still";
  if (analysis.brightness < GUIDANCE.darkBrightness) return "dark";
  if (!analysis.hasObject) return "no-object";

  if (Math.abs(analysis.xOffset) > GUIDANCE.offsetTolerance) {
    // The scene shifts opposite to the phone, so an item sitting left of
    // centre is centred by moving the phone left.
    return analysis.xOffset < 0 ? "left" : "right";
  }

  if (Math.abs(analysis.yOffset) > GUIDANCE.offsetTolerance) {
    return analysis.yOffset < 0 ? "up" : "down";
  }

  if (analysis.sizeRatio < GUIDANCE.minSizeRatio) return "closer";
  if (analysis.sizeRatio > GUIDANCE.maxSizeRatio) return "farther";

  return "centered";
}

const CUE_SPEECH: Record<Cue, string> = {
  "hold-still": "Hold still",
  dark: "The camera view is dark. Please move to better lighting.",
  "no-object":
    "I do not see an item. Point the camera at the trash you want to classify.",
  left: "Move phone left",
  right: "Move phone right",
  up: "Move phone up",
  down: "Move phone down",
  closer: "Move phone closer",
  farther: "Move phone farther",
  centered: "Item is centered. Hold still.",
};

const CUE_DISPLAY: Record<Cue, string> = {
  "hold-still": "Hold still",
  dark: "Too dark — find better light",
  "no-object": "Point the camera at the item",
  left: "Move phone left",
  right: "Move phone right",
  up: "Move phone up",
  down: "Move phone down",
  closer: "Move phone closer",
  farther: "Move phone farther",
  centered: "Item centered — hold still",
};

export function cueSpeech(cue: Cue): string {
  return CUE_SPEECH[cue];
}

export function cueLabel(cue: Cue): string {
  return CUE_DISPLAY[cue];
}

/**
 * Accelerometer magnitude sits at roughly 1g at rest, so movement shows up as
 * the spread of recent samples rather than their absolute value.
 */
export class ShakeDetector {
  private samples: { magnitude: number; at: number }[] = [];

  constructor(
    private readonly windowMs = 600,
    private readonly threshold = 0.25,
  ) {}

  push(x: number, y: number, z: number, now = Date.now()) {
    this.samples.push({ magnitude: Math.sqrt(x * x + y * y + z * z), at: now });
    const cutoff = now - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].at < cutoff) {
      this.samples.shift();
    }
  }

  reset() {
    this.samples = [];
  }

  isShaking(): boolean {
    if (this.samples.length < 3) return false;
    let min = Infinity;
    let max = -Infinity;
    for (const sample of this.samples) {
      if (sample.magnitude < min) min = sample.magnitude;
      if (sample.magnitude > max) max = sample.magnitude;
    }
    return max - min > this.threshold;
  }
}

/** Tracks how long the item has been continuously centred. */
export class StabilityTracker {
  private count = 0;
  private since: number | null = null;

  reset() {
    this.count = 0;
    this.since = null;
  }

  /** Returns true once the item has held the centre long enough to capture. */
  push(cue: Cue, now = Date.now()): boolean {
    if (cue !== "centered") {
      this.reset();
      return false;
    }

    this.count += 1;
    if (this.since === null) this.since = now;

    return (
      this.count >= GUIDANCE.stableFrames &&
      now - this.since >= GUIDANCE.stableDurationMs
    );
  }
}
