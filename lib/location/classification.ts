import type { Industry } from "@/lib/industries";
import type { Category } from "./types";

// Onboarding industry → SCIAN prefixes (architecture.md §15, Classification).
// The only copy of this table.
const PREFIXES: Record<Industry, { same: string[]; related: string[] }> = {
  food_beverage: { same: ["722"], related: ["461", "7139", "721"] },
  clothing_accessories: { same: ["463"], related: ["462", "465", "8121"] },
  technology_electronics: { same: ["4662", "8112"], related: ["465", "462"] },
  beauty_personal_care: { same: ["8121"], related: ["463", "464"] },
  health: { same: ["621"], related: ["464", "622"] },
  education: { same: ["611"], related: ["465", "722"] },
  professional_services: { same: ["54"], related: ["52", "53", "56"] },
  construction_maintenance: { same: ["23", "811"], related: ["467", "4661"] },
  retail: { same: ["46"], related: ["722", "812"] },
  other: { same: [], related: [] },
};

// `other` has no SCIAN mapping: competition and related businesses are not
// available for it.
export const hasClassification = (industry: Industry) =>
  PREFIXES[industry].same.length > 0;

export function classify(scian: string | null, industry: Industry): Category {
  if (!scian) return "other";
  const { same, related } = PREFIXES[industry];
  if (same.some((p) => scian.startsWith(p))) return "same";
  if (related.some((p) => scian.startsWith(p))) return "related";
  return "other";
}
