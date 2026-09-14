import { File } from "expo-file-system";

import { API_KEY, SEGREGATE_ENDPOINT } from "../config";

export type Segregation = "recyclable" | "trash" | string;

export type SegregationResponse = {
  success: boolean;
  segregation: Segregation;
  bin: string;
  confidence: number;
  confidencePercent: number;
  message: string;
  instruction: string;
  probabilities?: Record<string, number>;
};

type ImageForUpload = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function getImageName(image: ImageForUpload): string {
  if (image.fileName) return image.fileName;
  const uriName = image.uri.split("/").pop();
  return uriName || "waste-photo.jpg";
}

function getImageType(image: ImageForUpload): string {
  if (image.mimeType) return image.mimeType;
  const lowerName = getImageName(image).toLowerCase();
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function classifyWasteImage(
  image: ImageForUpload,
): Promise<SegregationResponse> {
  // Expo's fetch rejects React Native's `{ uri, name, type }` form parts, and
  // React Native's Blob cannot be built from bytes. A part exposing `bytes()`,
  // `name` and `type` is the shape Expo's multipart encoder accepts.
  const file = new File(image.uri);
  const part = {
    name: getImageName(image),
    type: getImageType(image),
    bytes: () => file.bytes(),
  };

  const formData = new FormData();
  formData.append("image", part as unknown as Blob);

  const response = await fetch(SEGREGATE_ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
    },
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message || payload?.message || "Unable to classify image.";
    throw new Error(message);
  }

  return payload as SegregationResponse;
}
