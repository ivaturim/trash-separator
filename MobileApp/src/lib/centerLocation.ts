import * as Location from "expo-location";

import type { Coordinates } from "./centerTypes";

const CACHE_TTL_MS = 15 * 60 * 1000;

type CachedFix = {
  coords: Coordinates;
  at: number;
};

let cache: CachedFix | null = null;

export type LocationPermission = "granted" | "denied" | "undetermined";

export function readCachedLocation(now = Date.now()): Coordinates | null {
  if (!cache) return null;
  if (now - cache.at > CACHE_TTL_MS) return null;
  return cache.coords;
}

export function writeCachedLocation(coords: Coordinates, now = Date.now()) {
  cache = { coords, at: now };
}

export async function getPermissionStatus(): Promise<LocationPermission> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return "granted";
  if (current.status === Location.PermissionStatus.UNDETERMINED) {
    return "undetermined";
  }
  return "denied";
}

export async function requestLocationPermission(): Promise<boolean> {
  const result = await Location.requestForegroundPermissionsAsync();
  return result.granted;
}

export async function getCurrentCoordinates(): Promise<Coordinates> {
  const cached = readCachedLocation();
  if (cached) return cached;

  const fix = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const coords = { lat: fix.coords.latitude, lng: fix.coords.longitude };
  writeCachedLocation(coords);
  return coords;
}

export async function geocodeZip(zipCode: string): Promise<Coordinates> {
  const trimmed = zipCode.trim();
  const results = await Location.geocodeAsync(`${trimmed}, USA`);
  const first = results[0];
  if (!first) {
    throw new Error("Could not find that ZIP code. Check the number and try again.");
  }
  const coords = { lat: first.latitude, lng: first.longitude };
  writeCachedLocation(coords);
  return coords;
}

export function isUsZip(value: string): boolean {
  return /^\d{5}$/.test(value.trim());
}
