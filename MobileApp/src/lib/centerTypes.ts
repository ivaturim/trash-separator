export const ACCEPTED_MATERIALS = [
  "plastic",
  "paper",
  "cardboard",
  "glass",
  "metal",
  "electronics",
  "hazardous",
  "compost",
  "textiles",
] as const;

export type AcceptedMaterial = (typeof ACCEPTED_MATERIALS)[number];

export type RecyclingCenter = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  lat: number;
  lng: number;
  phone: string;
  website: string | null;
  hours: string;
  acceptedMaterials: AcceptedMaterial[];
  notes?: string;
};

export type LocatedCenter = RecyclingCenter & {
  distanceMiles: number;
};

export type Coordinates = {
  lat: number;
  lng: number;
};

export const SEARCH_RADIUS_MILES = 25;
