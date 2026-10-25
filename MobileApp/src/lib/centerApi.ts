import demoCenters from "../data/recyclingCenters.json";
import { milesBetween } from "./geo";
import { centerAccepts } from "./materialMatch";
import {
  SEARCH_RADIUS_MILES,
  type AcceptedMaterial,
  type LocatedCenter,
  type RecyclingCenter,
} from "./centerTypes";

/**
 * Demo inventory. Names and addresses are realistic stand-ins for a classroom
 * demo, not a live directory — swap `getCenterSource()` to Earth911 when an
 * API key is available.
 */
const MOCK_CENTERS = demoCenters as RecyclingCenter[];

export type CenterSource = {
  findNear(
    lat: number,
    lng: number,
    radiusMiles: number,
    materials?: AcceptedMaterial[] | null,
  ): Promise<LocatedCenter[]>;
};

function locate(
  centers: RecyclingCenter[],
  lat: number,
  lng: number,
  radiusMiles: number,
  materials?: AcceptedMaterial[] | null,
): LocatedCenter[] {
  const origin = { lat, lng };
  return centers
    .filter((center) => centerAccepts(center.acceptedMaterials, materials ?? null))
    .map((center) => ({
      ...center,
      distanceMiles: milesBetween(origin, { lat: center.lat, lng: center.lng }),
    }))
    .filter((center) => center.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export const MockCenterSource: CenterSource = {
  async findNear(lat, lng, radiusMiles, materials) {
    return locate(MOCK_CENTERS, lat, lng, radiusMiles, materials);
  },
};

/**
 * TODO: register at https://earth911.com and put the key in
 * EXPO_PUBLIC_EARTH911_API_KEY. This provider is structured to drop in
 * without changing the screens — it is not called unless that key is set.
 *
 * Earth911's search is a GET to
 * `http://api.earth911.com/earth911.searchLocations` with `latitude`,
 * `longitude`, `api_key`, and optional `material_id`. Map each result onto
 * `RecyclingCenter` here.
 */
export const Earth911CenterSource: CenterSource = {
  async findNear(lat, lng, radiusMiles, materials) {
    const apiKey = (process.env.EXPO_PUBLIC_EARTH911_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new Error("Earth911 API key is not configured.");
    }

    const params = new URLSearchParams({
      api_key: apiKey,
      latitude: String(lat),
      longitude: String(lng),
      max_distance: String(radiusMiles),
    });

    const response = await fetch(
      `https://api.earth911.com/earth911.searchLocations?${params.toString()}`,
    );
    if (!response.ok) {
      throw new Error("Earth911 could not look up nearby centers.");
    }

    const payload = (await response.json()) as {
      result?: Array<{
        location_id?: string;
        description?: string;
        address?: string;
        city?: string;
        province?: string;
        postal_code?: string;
        latitude?: number;
        longitude?: number;
        phone?: string;
        url?: string;
        hours?: string;
      }>;
    };

    const mapped: RecyclingCenter[] = (payload.result ?? []).map((row, index) => ({
      id: String(row.location_id ?? `earth911-${index}`),
      name: row.description ?? "Recycling center",
      address: row.address ?? "",
      city: row.city ?? "",
      state: row.province ?? "",
      zipCode: row.postal_code ?? "",
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      phone: row.phone ?? "",
      website: row.url ?? null,
      hours: row.hours ?? "Hours not listed",
      acceptedMaterials: materials ?? [],
    }));

    return locate(mapped, lat, lng, radiusMiles, materials);
  },
};

export function getCenterSource(): CenterSource {
  const key = (process.env.EXPO_PUBLIC_EARTH911_API_KEY ?? "").trim();
  return key ? Earth911CenterSource : MockCenterSource;
}

export { SEARCH_RADIUS_MILES };
