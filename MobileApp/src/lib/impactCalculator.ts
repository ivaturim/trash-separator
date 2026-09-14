import type { ClassificationEntry } from "./historyStore";

export type MaterialImpact = {
  co2SavedKg: number;
  waterSavedL: number;
};

export const MATERIAL_IMPACT: Record<string, MaterialImpact> = {
  cardboard: { co2SavedKg: 0.9, waterSavedL: 10 },
  paper: { co2SavedKg: 0.5, waterSavedL: 8 },
  plastic: { co2SavedKg: 1.5, waterSavedL: 20 },
  metal: { co2SavedKg: 4.5, waterSavedL: 40 },
  glass: { co2SavedKg: 0.3, waterSavedL: 5 },
  trash: { co2SavedKg: 0, waterSavedL: 0 },
};

const NO_IMPACT: MaterialImpact = { co2SavedKg: 0, waterSavedL: 0 };

/**
 * The binary model reports "recyclable" rather than a specific material, so
 * those entries are credited with the mean of the five known recyclables.
 * Replace this with a real lookup once the model emits material classes.
 */
export const MIXED_RECYCLABLE_IMPACT: MaterialImpact = {
  co2SavedKg: 1.54,
  waterSavedL: 16.6,
};

export function impactForMaterial(
  material: string,
  segregation: ClassificationEntry["segregation"],
): MaterialImpact {
  const known = MATERIAL_IMPACT[material.toLowerCase().trim()];
  if (known) return known;
  return segregation === "recyclable" ? MIXED_RECYCLABLE_IMPACT : NO_IMPACT;
}

export type MaterialCount = {
  material: string;
  count: number;
};

export type DayCount = {
  label: string;
  count: number;
  isToday: boolean;
};

export type ImpactSummary = {
  totalItems: number;
  recycledItems: number;
  trashedItems: number;
  co2SavedKg: number;
  waterSavedL: number;
  streakDays: number;
  topMaterials: MaterialCount[];
  thisWeek: DayCount[];
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday of the week containing `date`, at local midnight. */
function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  return addDays(start, -daysSinceMonday);
}

/**
 * Counts consecutive days that contain at least one classification. A day with
 * no activity yet does not break the streak, so the count is anchored to today
 * when today has an entry and to yesterday otherwise.
 */
function calculateStreak(dayKeys: Set<string>, now: Date): number {
  if (dayKeys.size === 0) return 0;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let cursor = dayKeys.has(localDayKey(today)) ? today : addDays(today, -1);
  if (!dayKeys.has(localDayKey(cursor))) return 0;

  let streak = 0;
  while (dayKeys.has(localDayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function calculateThisWeek(entries: ClassificationEntry[], now: Date): DayCount[] {
  const weekStart = startOfWeek(now);
  const todayKey = localDayKey(now);

  const counts = new Map<string, number>();
  for (const entry of entries) {
    const date = new Date(entry.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    if (date < weekStart) continue;
    const key = localDayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return WEEKDAY_LABELS.map((label, index) => {
    const key = localDayKey(addDays(weekStart, index));
    return {
      label,
      count: counts.get(key) ?? 0,
      isToday: key === todayKey,
    };
  });
}

function calculateTopMaterials(
  entries: ClassificationEntry[],
  limit: number,
): MaterialCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const material = entry.material.toLowerCase().trim() || entry.segregation;
    counts.set(material, (counts.get(material) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([material, count]) => ({ material, count }))
    .sort((a, b) => b.count - a.count || a.material.localeCompare(b.material))
    .slice(0, limit);
}

export function summarizeImpact(
  entries: ClassificationEntry[],
  now: Date = new Date(),
): ImpactSummary {
  let recycledItems = 0;
  let co2SavedKg = 0;
  let waterSavedL = 0;
  const dayKeys = new Set<string>();

  for (const entry of entries) {
    if (entry.segregation === "recyclable") recycledItems++;

    const impact = impactForMaterial(entry.material, entry.segregation);
    co2SavedKg += impact.co2SavedKg;
    waterSavedL += impact.waterSavedL;

    const date = new Date(entry.timestamp);
    if (!Number.isNaN(date.getTime())) {
      dayKeys.add(localDayKey(date));
    }
  }

  return {
    totalItems: entries.length,
    recycledItems,
    trashedItems: entries.length - recycledItems,
    co2SavedKg: Math.round(co2SavedKg * 10) / 10,
    waterSavedL: Math.round(waterSavedL * 10) / 10,
    streakDays: calculateStreak(dayKeys, now),
    topMaterials: calculateTopMaterials(entries, 3),
    thisWeek: calculateThisWeek(entries, now),
  };
}
