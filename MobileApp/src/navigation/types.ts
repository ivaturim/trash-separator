import type { LocatedCenter, RecyclingCenter } from "../lib/centerTypes";
import type { ClassificationEntry } from "../lib/historyStore";
import type { BarcodeProduct } from "../lib/openFoodFactsClient";

export type RootStackParamList = {
  /** `pendingCapture` lets the barcode fallback hand off to the photo flow. */
  Home: { pendingCapture?: "camera" | "library" } | undefined;
  Chat: { classification: ClassificationEntry };
  Impact: undefined;
  GuidedMode: undefined;
  Settings: undefined;
  LanguageSettings: undefined;
  BarcodeScanner: undefined;
  BarcodeResult: { product: BarcodeProduct };
  NearbyCenters:
    | { material?: string; segregation?: string }
    | undefined;
  CenterDetail: { center: RecyclingCenter | LocatedCenter; distanceMiles?: number };
};
