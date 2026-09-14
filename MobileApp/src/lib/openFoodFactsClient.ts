import {
  classifyComponent,
  humanizeTaxonomyId,
  normalizeGrade,
  type EcoscoreGrade,
  type PackagingComponent,
} from "./ecoscore";

const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS = [
  "product_name",
  "brands",
  "image_url",
  "ecoscore_grade",
  "packaging_text",
  "packagings",
].join(",");
const REQUEST_TIMEOUT_MS = 15000;

/** Open Food Facts asks API clients to identify themselves. */
const USER_AGENT = "TrashSeparator/1.0 (student project)";

export type BarcodeProduct = {
  barcode: string;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  ecoscoreGrade: EcoscoreGrade;
  packagingText: string | null;
  components: PackagingComponent[];
};

export type ProductLookupFailure = "not-found" | "network" | "server";

export class ProductLookupError extends Error {
  readonly kind: ProductLookupFailure;

  constructor(kind: ProductLookupFailure, message: string) {
    super(message);
    this.name = "ProductLookupError";
    this.kind = kind;
  }
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * `packagings` entries are partial: some describe only a shape with no
 * material, so those are dropped rather than rendered as blank rows.
 */
function parseComponents(packagings: unknown): PackagingComponent[] {
  if (!Array.isArray(packagings)) return [];

  return packagings
    .filter((entry) => entry && typeof entry === "object")
    .map((entry: any) => {
      const materialId = cleanText(entry.material);
      const { recyclability, advice } = classifyComponent(
        materialId,
        cleanText(entry.recycling),
      );
      return {
        material: humanizeTaxonomyId(materialId),
        shape: humanizeTaxonomyId(cleanText(entry.shape)),
        recyclability,
        advice,
      };
    })
    .filter((component) => component.material.length > 0);
}

export async function fetchProductByBarcode(
  barcode: string,
): Promise<BarcodeProduct> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `${PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: controller.signal,
      },
    );
  } catch {
    throw new ProductLookupError(
      "network",
      controller.signal.aborted
        ? "The product lookup timed out. Check your connection and try again."
        : "Could not reach Open Food Facts. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 404) {
    throw new ProductLookupError(
      "not-found",
      "This barcode is not in the Open Food Facts database.",
    );
  }
  if (!response.ok) {
    throw new ProductLookupError(
      "server",
      "Open Food Facts is unavailable right now. Please try again shortly.",
    );
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new ProductLookupError(
      "server",
      "Open Food Facts returned a response we could not read.",
    );
  }

  // A missing product is reported as `status: 0` with a 200 response.
  if (payload?.status !== 1 || !payload?.product) {
    throw new ProductLookupError(
      "not-found",
      "This barcode is not in the Open Food Facts database.",
    );
  }

  const product = payload.product;
  return {
    barcode,
    name: cleanText(product.product_name),
    brand: cleanText(product.brands),
    imageUrl: cleanText(product.image_url),
    ecoscoreGrade: normalizeGrade(product.ecoscore_grade),
    packagingText: cleanText(product.packaging_text),
    components: parseComponents(product.packagings),
  };
}
