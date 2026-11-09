import type { Industry } from "@/lib/industries";
import { classify } from "./classification";
import {
  type Counts,
  type DenueEstablishment,
  type Establishment,
  LocationError,
} from "./types";

// Candidate zones (architecture.md §15, SPEC-LOC-04). Deterministic: the same
// establishments and parameters always give the same candidates.

export const ZONE_RADIUS_M = 300;
const CELL_M = 300;
const MIN_CELL_ESTABLISHMENTS = 10;
const MIN_AREA_ESTABLISHMENTS = 20;
const EARTH_M = 6_371_000;
const RAD = Math.PI / 180;

type LatLon = { lat: number; lon: number };

export function distanceM(a: LatLon, b: LatLon): number {
  const h =
    Math.sin(((b.lat - a.lat) * RAD) / 2) ** 2 +
    Math.cos(a.lat * RAD) *
      Math.cos(b.lat * RAD) *
      Math.sin(((b.lon - a.lon) * RAD) / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

export type Metrics = { counts: Counts; staffMin: number; staffKnown: number };

export type Candidate = Metrics & {
  id: string;
  lat: number;
  lon: number;
  distanceM: number;
  name: string;
  topActivities: { activity: string; count: number }[];
  establishments: Establishment[];
};

function measure(list: Establishment[]): Metrics {
  const counts: Counts = { total: list.length, same: 0, related: 0, other: 0 };
  let staffMin = 0;
  let staffKnown = 0;
  for (const e of list) {
    counts[e.category] += 1;
    if (e.staffMin !== null) {
      staffMin += e.staffMin;
      staffKnown += 1;
    }
  }
  return { counts, staffMin, staffKnown };
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Values by frequency, ties alphabetically.
function ranked(values: string[]) {
  const tally = new Map<string, number>();
  for (const v of values) if (v) tally.set(v, (tally.get(v) ?? 0) + 1);
  return [...tally]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || compare(a.value, b.value));
}

const MINOR = new Set(["de", "del", "la", "las", "los", "el", "y"]);
const titleCase = (s: string) =>
  s
    .toLocaleLowerCase("es")
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && MINOR.has(w)
        ? w
        : w.charAt(0).toLocaleUpperCase("es") + w.slice(1),
    )
    .join(" ");

// The zone's name comes from data, never from the agent (SPEC-LOC-05).
function zoneName(list: Establishment[]) {
  return [list.map((e) => e.colonia), list.map((e) => e.street)]
    .map((values) => ranked(values)[0]?.value)
    .filter((v): v is string => Boolean(v))
    .map(titleCase)
    .join(" · ");
}

export function buildCandidates(
  denue: DenueEstablishment[],
  ref: LatLon & { radiusM: number },
  industry: Industry,
) {
  const all: Establishment[] = denue
    .map((e) => ({ ...e, category: classify(e.scian, industry) }))
    .sort((a, b) => compare(a.id, b.id));
  const inArea = all.filter((e) => distanceM(ref, e) <= ref.radiusM);
  const area = measure(inArea);

  // 300 m grid aligned to the reference point (flat projection).
  const cells = new Map<string, Establishment[]>();
  const mPerLon = EARTH_M * RAD * Math.cos(ref.lat * RAD);
  for (const e of inArea) {
    const i = Math.floor(((e.lon - ref.lon) * mPerLon) / CELL_M);
    const j = Math.floor(((e.lat - ref.lat) * EARTH_M * RAD) / CELL_M);
    const id = `c${i}_${j}`;
    cells.set(id, [...(cells.get(id) ?? []), e]);
  }

  const candidates: Candidate[] = [];
  for (const [id, members] of cells) {
    if (members.length < MIN_CELL_ESTABLISHMENTS) continue;
    const center = {
      lat: members.reduce((sum, e) => sum + e.lat, 0) / members.length,
      lon: members.reduce((sum, e) => sum + e.lon, 0) / members.length,
    };
    const zone = all.filter((e) => distanceM(center, e) <= ZONE_RADIUS_M);
    candidates.push({
      id,
      ...center,
      distanceM: Math.round(distanceM(ref, center)),
      ...measure(zone),
      name: zoneName(zone),
      topActivities: ranked(zone.map((e) => e.activity))
        .slice(0, 5)
        .map(({ value, count }) => ({ activity: value, count })),
      establishments: zone,
    });
  }
  candidates.sort((a, b) => a.distanceM - b.distanceM || compare(a.id, b.id));

  if (area.counts.total < MIN_AREA_ESTABLISHMENTS || candidates.length === 0) {
    throw new LocationError("insufficient_data", {
      establishments: area.counts.total,
      candidates: candidates.length,
    });
  }
  return { area, candidates };
}
