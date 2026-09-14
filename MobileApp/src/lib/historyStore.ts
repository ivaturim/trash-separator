import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SegregationResponse } from "../api/trashApi";

const HISTORY_KEY = "classificationHistory";
const LEGACY_HISTORY_KEY = "trash-separator-history";

/**
 * Impact totals are cumulative, so entries are not trimmed to a screenful.
 * The cap only stops the stored JSON from growing without bound.
 */
const MAX_ENTRIES = 200;

export type SegregationKind = "recyclable" | "trash";

export type EntryType = "photo" | "barcode";

export type ClassificationEntry = {
  id: string;
  timestamp: string;
  segregation: SegregationKind;
  material: string;
  confidencePercent: number;
  imageUri: string;
  /** Entries written before barcode scanning existed have no type. */
  type?: EntryType;
  /** Product name for barcode scans; unused for photo classifications. */
  label?: string;
};

export function normalizeSegregation(value: string): SegregationKind {
  return value.toLowerCase().includes("recycl") ? "recyclable" : "trash";
}

/**
 * The current model is binary, so `probabilities` usually only names the two
 * segregation classes. When it does expose a material class, that wins.
 */
export function inferMaterial(response: SegregationResponse): string {
  const probabilities = response.probabilities;
  const segregation = normalizeSegregation(response.segregation);

  if (probabilities) {
    const ranked = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
    const topLabel = ranked[0]?.[0]?.toLowerCase().trim();
    if (topLabel && topLabel !== "recyclable" && topLabel !== "trash") {
      return topLabel;
    }
  }

  return segregation;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createClassificationEntry(
  response: SegregationResponse,
  imageUri: string,
): ClassificationEntry {
  return {
    id: createId(),
    timestamp: new Date().toISOString(),
    segregation: normalizeSegregation(response.segregation),
    material: inferMaterial(response),
    confidencePercent: response.confidencePercent,
    imageUri,
    type: "photo",
  };
}

/**
 * Barcode lookups return packaging data rather than a prediction, so
 * confidence is recorded as 100 and the UI shows the product name instead.
 * A partly recyclable product counts as recyclable because some of its
 * packaging really is recycled.
 */
export function createBarcodeEntry(input: {
  segregation: SegregationKind;
  material: string;
  imageUri: string;
  label: string;
}): ClassificationEntry {
  return {
    id: createId(),
    timestamp: new Date().toISOString(),
    segregation: input.segregation,
    material: input.material,
    confidencePercent: 100,
    imageUri: input.imageUri,
    type: "barcode",
    label: input.label,
  };
}

function isEntry(value: any): value is ClassificationEntry {
  return (
    value &&
    typeof value.id === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.imageUri === "string" &&
    typeof value.confidencePercent === "number"
  );
}

function parseEntries(raw: string | null): ClassificationEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

/**
 * Entries written before the impact feature used a different key and shape
 * (`createdAt` instead of `timestamp`, no `material`). They are folded in once
 * so existing classifications still count towards the totals.
 */
async function migrateLegacyEntries(): Promise<ClassificationEntry[]> {
  const raw = await AsyncStorage.getItem(LEGACY_HISTORY_KEY);
  if (!raw) return [];

  let legacyItems: any[] = [];
  try {
    const parsed = JSON.parse(raw);
    legacyItems = Array.isArray(parsed) ? parsed : [];
  } catch {
    legacyItems = [];
  }

  const migrated: ClassificationEntry[] = legacyItems
    .filter((item) => item && typeof item.id === "string")
    .map((item) => ({
      id: item.id,
      timestamp: item.createdAt ?? new Date().toISOString(),
      segregation: normalizeSegregation(String(item.segregation ?? "trash")),
      material: normalizeSegregation(String(item.segregation ?? "trash")),
      confidencePercent: Number(item.confidencePercent) || 0,
      imageUri: String(item.imageUri ?? ""),
    }));

  await AsyncStorage.removeItem(LEGACY_HISTORY_KEY);
  if (migrated.length > 0) {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(migrated));
  }
  return migrated;
}

/** Newest first. */
export async function loadClassifications(): Promise<ClassificationEntry[]> {
  const entries = parseEntries(await AsyncStorage.getItem(HISTORY_KEY));
  if (entries.length > 0) return entries;
  return migrateLegacyEntries();
}

export async function appendClassification(
  entry: ClassificationEntry,
): Promise<ClassificationEntry[]> {
  const existing = await loadClassifications();
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function clearClassifications(): Promise<void> {
  await AsyncStorage.multiRemove([HISTORY_KEY, LEGACY_HISTORY_KEY]);
}
