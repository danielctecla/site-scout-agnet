import type { Industry } from "@/lib/industries";

// Contracts between the form, the pipeline, the agent and the stored
// evaluation (architecture.md §15).

export const RADII_M = [500, 1000, 2000, 3000] as const;
export type RadiusM = (typeof RADII_M)[number];

export type EvaluationInput = {
  reference: { label: string; lat: number; lon: number };
  radiusM: RadiusM;
  rentMxn: number | null;
  industry: Industry;
};

export type Category = "same" | "related" | "other";

export type Establishment = {
  id: string;
  name: string;
  activity: string;
  scian: string | null;
  address: string;
  colonia: string;
  street: string;
  lat: number;
  lon: number;
  staffMin: number | null;
  staffLabel: string | null;
  category: Category;
};

// As parsed from DENUE, before classification.
export type DenueEstablishment = Omit<Establishment, "category">;

export type Counts = {
  total: number;
  same: number;
  related: number;
  other: number;
};

export type FactorKey = "activity" | "competition" | "related" | "staff";

export type Factor = {
  key: FactorKey;
  available: boolean;
  zone: number;
  area: number;
  ratio: number | null;
  value: number | null;
  weight: number;
  points: number | null;
};

export type Explanation = {
  summary: string;
  opportunities: string[];
  considerations: string[];
  conclusion: string;
};

export type Zone = {
  rank: number;
  name: string;
  lat: number;
  lon: number;
  distanceM: number;
  score: number;
  factors: Factor[];
  counts: Counts;
  staffMin: number;
  explanation: Explanation;
  establishments: Establishment[];
};

export type EvaluationResult = {
  source: "INEGI DENUE";
  queriedAt: string;
  datasetDate: string | null;
  area: { counts: Counts; staffMin: number };
  zones: Zone[];
};

export type LocationErrorKey =
  | "place_not_found"
  | "geocoding_unavailable"
  | "denue_unavailable"
  | "insufficient_data"
  | "analysis_failed"
  | "no_valid_zones";

export class LocationError extends Error {
  constructor(
    readonly key: LocationErrorKey,
    // Counts shown with insufficient_data (SPEC-LOC-04).
    readonly details?: Record<string, number>,
  ) {
    super(key);
  }
}
