import type { Industry } from "@/lib/industries";
import { type EvaluationInput, RADII_M, type RadiusM } from "./types";

// Form input rules (SPEC-LOC-03), shared by the form and the server action.

export const MAX_RENT_MXN = 10_000_000;

// Empty means "not provided". Returns the amount, null, or undefined when the
// text is not a whole number from 1 to 10,000,000.
export function parseRent(text: string): number | null | undefined {
  const value = text.replace(/[\s,$]/g, "");
  if (value === "") return null;
  if (!/^\d+$/.test(value)) return undefined;
  const rent = Number(value);
  return rent >= 1 && rent <= MAX_RENT_MXN ? rent : undefined;
}

export type EvaluationForm = {
  reference: { label: string; lat: number; lon: number };
  radiusM: number;
  rentMxn: number | null;
};

// The server never trusts the form: null when any value is out of range.
export function parseEvaluationInput(
  form: EvaluationForm,
  industry: Industry,
): EvaluationInput | null {
  const { label, lat, lon } = form.reference ?? {};
  const validPlace =
    typeof label === "string" &&
    label.trim().length >= 1 &&
    label.length <= 300 &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= 14 &&
    lat <= 33 &&
    lon >= -119 &&
    lon <= -86;
  const validRadius = RADII_M.includes(form.radiusM as RadiusM);
  const rent = form.rentMxn;
  const validRent =
    rent === null ||
    (Number.isInteger(rent) && rent >= 1 && rent <= MAX_RENT_MXN);
  if (!validPlace || !validRadius || !validRent) return null;
  return {
    reference: { label: label.trim(), lat, lon },
    radiusM: form.radiusM as RadiusM,
    rentMxn: rent,
    industry,
  };
}
