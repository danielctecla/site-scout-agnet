import type { Factor, FactorKey } from "./types";
import { type Metrics, ZONE_RADIUS_M } from "./zones";

// Opportunity score, computed only here (architecture.md §15, Scoring). Each
// factor compares the zone's density with the exploration area's.

const WEIGHTS: Record<FactorKey, number> = {
  activity: 30,
  competition: 30,
  related: 25,
  staff: 15,
};

const km2 = (radiusM: number) => Math.PI * (radiusM / 1000) ** 2;
const round = (n: number, digits: number) => Number(n.toFixed(digits));
const capped = (ratio: number) => Math.min(ratio / 2, 1);

export function scoreZone(
  zone: Metrics,
  area: Metrics,
  { radiusM, classified }: { radiusM: number; classified: boolean },
): { factors: Factor[]; score: number } {
  const zoneKm2 = km2(ZONE_RADIUS_M);
  const areaKm2 = km2(radiusM);

  // [key, zone amount, area amount, available, value when the area has none]
  const inputs: [FactorKey, number, number, boolean, number | null][] = [
    ["activity", zone.counts.total, area.counts.total, true, null],
    ["competition", zone.counts.same, area.counts.same, classified, 1],
    ["related", zone.counts.related, area.counts.related, classified, 0],
    ["staff", zone.staffMin, area.staffMin, area.staffMin > 0, null],
  ];

  const draft = inputs.map(
    ([key, zoneAmount, areaAmount, available, empty]) => {
      const zoneDensity = zoneAmount / zoneKm2;
      const areaDensity = areaAmount / areaKm2;
      const ratio =
        available && areaAmount > 0 ? zoneDensity / areaDensity : null;
      const value = !available
        ? null
        : ratio === null
          ? empty
          : key === "competition"
            ? 1 - capped(ratio)
            : capped(ratio);
      return {
        key,
        available,
        zone: round(zoneDensity, 1),
        area: round(areaDensity, 1),
        ratio: ratio === null ? null : round(ratio, 2),
        value,
        weight: WEIGHTS[key],
      };
    },
  );

  const totalWeight = draft.reduce(
    (sum, f) => sum + (f.value === null ? 0 : f.weight),
    0,
  );
  const raw = draft.map((f) =>
    f.value === null ? null : (100 * f.weight * f.value) / totalWeight,
  );
  const score = Math.round(raw.reduce<number>((sum, p) => sum + (p ?? 0), 0));
  const factors: Factor[] = draft.map((f, i) => ({
    ...f,
    value: f.value === null ? null : round(f.value, 3),
    points: raw[i] === null ? null : round(raw[i], 1),
  }));
  return { factors, score };
}

// Highest score first; ties go to the zone closer to the reference.
export function rankZones<
  T extends { score: number; distanceM: number; rank: number },
>(zones: T[]): T[] {
  return [...zones]
    .sort((a, b) => b.score - a.score || a.distanceM - b.distanceM)
    .map((z, i) => ({ ...z, rank: i + 1 }));
}
