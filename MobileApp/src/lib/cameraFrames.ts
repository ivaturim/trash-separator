import type { CameraView } from "expo-camera";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import decodeJpeg from "jpeg-js/lib/decoder";
import { Platform } from "react-native";

import { analyzeRgbaFrame, type FrameAnalysis } from "./frameGuidance";

/**
 * Wide enough to keep a Sobel pass meaningful, small enough that decoding it
 * in JavaScript costs a few milliseconds.
 */
const ANALYSIS_WIDTH = 96;

/**
 * Grabs one still and reduces it to a framing measurement.
 *
 * Expo Go has no real-time frame stream: `react-native-vision-camera` frame
 * processors and `@tensorflow/tfjs-react-native` both need a development
 * build. So guidance samples stills instead, keeping the whole pipeline off
 * disk where possible — the full-size photo stays a native bitmap
 * (`pictureRef`) and only the 96px copy is written out to be decoded.
 *
 * FUTURE WORK: in a development build, replace this function with a
 * VisionCamera frame processor feeding a TensorFlow Lite mobile object
 * detector (for example `coco-ssd`). The detector's bounding box maps onto
 * `FrameAnalysis` directly: `xOffset`/`yOffset` from the box centre and
 * `sizeRatio` from its longest side. Nothing else in Guided Mode changes.
 *
 * @returns null when the frame could not be captured or decoded; callers
 *   should treat that as "no reading this tick" rather than "no item".
 */
export async function captureAnalysisFrame(
  camera: CameraView,
): Promise<FrameAnalysis | null> {
  if (Platform.OS === "web") {
    return captureAnalysisFrameWeb(camera);
  }

  return captureAnalysisFrameNative(camera);
}

/**
 * On the website, `pictureRef`, ImageManipulator, and expo-file-system File
 * are not available. Expo Camera already draws the live video to a canvas and
 * returns a data URL, so we shrink that in the page and run the same Sobel
 * pass as native.
 */
async function captureAnalysisFrameWeb(
  camera: CameraView,
): Promise<FrameAnalysis | null> {
  try {
    const photo = await camera.takePictureAsync({
      shutterSound: false,
      exif: false,
      quality: 0.2,
    });
    if (!photo?.uri) return null;
    return await analyzeImageUriOnWeb(photo.uri);
  } catch {
    return null;
  }
}

function analyzeImageUriOnWeb(uri: string): Promise<FrameAnalysis | null> {
  return new Promise((resolve) => {
    const image = document.createElement("img");
    image.onload = () => {
      try {
        const width = ANALYSIS_WIDTH;
        const height = Math.max(
          1,
          Math.round((image.height / Math.max(1, image.width)) * width),
        );
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        const { data } = ctx.getImageData(0, 0, width, height);
        resolve(analyzeRgbaFrame(data, width, height));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = uri;
  });
}

async function captureAnalysisFrameNative(
  camera: CameraView,
): Promise<FrameAnalysis | null> {
  let savedUri: string | null = null;

  try {
    // `skipProcessing` is deliberately off: it returns the sensor's native
    // landscape orientation, which would swap the left/right and up/down cues.
    const picture = await camera.takePictureAsync({
      pictureRef: true,
      shutterSound: false,
      exif: false,
      quality: 0.3,
    });

    const rendered = await ImageManipulator.manipulate(picture)
      .resize({ width: ANALYSIS_WIDTH })
      .renderAsync();
    picture.release();

    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.7,
    });
    rendered.release();
    savedUri = saved.uri;

    const bytes = await new File(saved.uri).bytes();
    const decoded = decodeJpeg(bytes, { useTArray: true });

    return analyzeRgbaFrame(decoded.data, decoded.width, decoded.height);
  } catch {
    return null;
  } finally {
    if (savedUri) {
      // Guidance runs a few frames a second, so leftovers would pile up fast.
      try {
        new File(savedUri).delete();
      } catch {
        // A stranded temp file is harmless; the cache directory is cleaned up
        // by the OS.
      }
    }
  }
}
