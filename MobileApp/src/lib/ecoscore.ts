export type EcoscoreGrade = "a" | "b" | "c" | "d" | "e" | "unknown";

export type Recyclability = "recyclable" | "trash" | "unknown";

export type Disposal = "recyclable" | "mixed" | "trash" | "unknown";

export type PackagingComponent = {
  /** Human readable material, e.g. "Clear glass". */
  material: string;
  /** Human readable shape, e.g. "Pot". Empty when the API omits it. */
  shape: string;
  recyclability: Recyclability;
  /** Advice shown under the component, derived from the API's recycling field. */
  advice: string;
};

const GRADE_COLORS: Record<EcoscoreGrade, string> = {
  a: "#047857",
  b: "#10b981",
  c: "#f59e0b",
  d: "#f97316",
  e: "#ef4444",
  unknown: "#9ca3af",
};

const GRADE_LABELS: Record<EcoscoreGrade, string> = {
  a: "Very low environmental impact",
  b: "Low environmental impact",
  c: "Moderate environmental impact",
  d: "High environmental impact",
  e: "Very high environmental impact",
  unknown: "No Eco-Score published for this product",
};

/**
 * Open Food Facts reports grades as "a" through "e", but also "unknown" and
 * "not-applicable" for products it has not scored.
 */
export function normalizeGrade(value?: string | null): EcoscoreGrade {
  const grade = (value ?? "").toLowerCase().trim();
  return grade === "a" ||
    grade === "b" ||
    grade === "c" ||
    grade === "d" ||
    grade === "e"
    ? grade
    : "unknown";
}

export function ecoscoreColor(grade: EcoscoreGrade): string {
  return GRADE_COLORS[grade];
}

export function ecoscoreLabel(grade: EcoscoreGrade): string {
  return GRADE_LABELS[grade];
}

/** Turns a taxonomy id such as "en:clear-glass" into "Clear glass". */
export function humanizeTaxonomyId(value?: string | null): string {
  const withoutLanguage = (value ?? "").replace(/^[a-z]{2}:/, "");
  const spaced = withoutLanguage.replace(/-/g, " ").trim();
  if (!spaced) return "";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const RECYCLABLE_MATERIALS = [
  "glass",
  "metal",
  "aluminium",
  "aluminum",
  "steel",
  "tinplate",
  "paper",
  "cardboard",
  "paperboard",
  "pet",
  "hdpe",
];

const NON_RECYCLABLE_MATERIALS = ["pvc", "polystyrene", "composite", "wax"];

/**
 * The API's `recycling` field is authoritative when present. Otherwise the
 * material itself is used, and anything ambiguous (generic plastic, films,
 * mixed materials) stays "unknown" rather than guessing.
 */
export function classifyComponent(
  materialId?: string | null,
  recyclingId?: string | null,
): { recyclability: Recyclability; advice: string } {
  const recycling = (recyclingId ?? "").toLowerCase();

  if (recycling.includes("recycle")) {
    return {
      recyclability: "recyclable",
      advice: humanizeTaxonomyId(recyclingId) || "Recycle this component",
    };
  }
  if (
    recycling.includes("discard") ||
    recycling.includes("throw") ||
    recycling.includes("non-recyclable")
  ) {
    return {
      recyclability: "trash",
      advice: humanizeTaxonomyId(recyclingId) || "Put this component in the bin",
    };
  }

  const material = (materialId ?? "").toLowerCase();
  if (RECYCLABLE_MATERIALS.some((known) => material.includes(known))) {
    return {
      recyclability: "recyclable",
      advice: "Usually recyclable — check your local rules",
    };
  }
  if (NON_RECYCLABLE_MATERIALS.some((known) => material.includes(known))) {
    return {
      recyclability: "trash",
      advice: "Usually not recyclable — put it in the bin",
    };
  }

  return {
    recyclability: "unknown",
    advice: "No recycling guidance published for this component",
  };
}

export function suggestDisposal(components: PackagingComponent[]): {
  disposal: Disposal;
  headline: string;
  detail: string;
} {
  const known = components.filter(
    (component) => component.recyclability !== "unknown",
  );

  if (components.length === 0 || known.length === 0) {
    return {
      disposal: "unknown",
      headline: "Unknown",
      detail:
        "Open Food Facts has no packaging details for this product, so try photo classification instead.",
    };
  }

  const recyclableCount = known.filter(
    (component) => component.recyclability === "recyclable",
  ).length;

  if (recyclableCount === known.length) {
    return {
      disposal: "recyclable",
      headline: "Recyclable",
      detail:
        components.length > 1
          ? "Separate the components, then put them all in recycling."
          : "Put it in the recycling bin.",
    };
  }

  if (recyclableCount === 0) {
    return {
      disposal: "trash",
      headline: "Trash",
      detail: "None of the packaging is recyclable, so it goes in the bin.",
    };
  }

  return {
    disposal: "mixed",
    headline: "Mixed",
    detail:
      "Separate the packaging: recycle the parts marked recyclable and bin the rest.",
  };
}

export function disposalColors(disposal: Disposal): {
  background: string;
  accent: string;
} {
  switch (disposal) {
    case "recyclable":
      return { background: "#d1fae5", accent: "#047857" };
    case "mixed":
      return { background: "#fef3c7", accent: "#b45309" };
    case "trash":
      return { background: "#ffedd5", accent: "#c2410c" };
    default:
      return { background: "#f3f4f6", accent: "#4b5563" };
  }
}
