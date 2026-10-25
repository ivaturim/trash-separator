import {
  ACCEPTED_MATERIALS,
  type AcceptedMaterial,
} from "./centerTypes";

const COMMON_RECYCLABLES: AcceptedMaterial[] = [
  "plastic",
  "paper",
  "cardboard",
  "glass",
  "metal",
];

const ALIASES: { material: AcceptedMaterial; needles: string[] }[] = [
  { material: "plastic", needles: ["plastic", "pet", "hdpe", "bottle", "polymer"] },
  { material: "paper", needles: ["paper", "newspaper", "magazine", "mail"] },
  { material: "cardboard", needles: ["cardboard", "box", "carton"] },
  { material: "glass", needles: ["glass", "jar"] },
  { material: "metal", needles: ["metal", "aluminum", "aluminium", "steel", "can", "tin"] },
  {
    material: "electronics",
    needles: ["electronic", "ewaste", "e-waste", "phone", "laptop", "battery"],
  },
  {
    material: "hazardous",
    needles: ["hazard", "paint", "chemical", "oil", "solvent"],
  },
  { material: "compost", needles: ["compost", "food", "organic", "yard"] },
  { material: "textiles", needles: ["textile", "cloth", "clothing", "fabric"] },
];

/**
 * Turns a model label ("recyclable", "plastic bottle") into the drop-off
 * materials we should filter on. Generic recyclable items match any of the
 * five common streams; trash is left unfiltered so the user still sees nearby
 * options.
 */
export function materialsForClassification(
  material: string,
  segregation?: string,
): AcceptedMaterial[] | null {
  const haystack = `${material} ${segregation ?? ""}`.toLowerCase();

  const matched = ALIASES.filter(({ needles }) =>
    needles.some((needle) => haystack.includes(needle)),
  ).map(({ material: next }) => next);

  const unique = ACCEPTED_MATERIALS.filter((item) => matched.includes(item));
  if (unique.length > 0) return unique;

  if (haystack.includes("recycl")) return COMMON_RECYCLABLES;
  return null;
}

export function centerAccepts(
  accepted: AcceptedMaterial[],
  filter: AcceptedMaterial[] | null,
): boolean {
  if (!filter || filter.length === 0) return true;
  return filter.some((material) => accepted.includes(material));
}

export function materialLabel(material: AcceptedMaterial): string {
  return material.charAt(0).toUpperCase() + material.slice(1);
}
