import { proposeZones, type Ratios } from "./agent";
import { hasClassification } from "./classification";
import { rankZones, scoreZone } from "./scoring";
import {
  type DenueEstablishment,
  type EvaluationInput,
  type EvaluationResult,
  LocationError,
  type Zone,
} from "./types";
import { buildCandidates, ZONE_RADIUS_M } from "./zones";

// The evaluation pipeline (architecture.md §15, Flow). DENUE, the agent and
// the clock are passed in, so tests run without network access.

export type EvaluateDeps = {
  fetchEstablishments: (point: {
    lat: number;
    lon: number;
    radiusM: number;
  }) => Promise<DenueEstablishment[]>;
  ask: (prompt: string) => Promise<unknown>;
  now?: () => Date;
};

const oneDecimal = (n: number | null) =>
  n === null ? null : Number(n.toFixed(1));

export async function evaluate(
  input: EvaluationInput,
  { fetchEstablishments, ask, now = () => new Date() }: EvaluateDeps,
  locale: "es" | "en" = "es",
): Promise<EvaluationResult> {
  const { lat, lon } = input.reference;
  const { radiusM, industry } = input;
  const denue = await fetchEstablishments({
    lat,
    lon,
    radiusM: radiusM + ZONE_RADIUS_M,
  });
  const queriedAt = now().toISOString();

  const { area, candidates } = buildCandidates(
    denue,
    { lat, lon, radiusM },
    industry,
  );
  const classified = hasClassification(industry);
  const scored = new Map(
    candidates.map((c) => [c.id, scoreZone(c, area, { radiusM, classified })]),
  );
  // The agent sees ratios, never scores.
  const ratios = Object.fromEntries(
    candidates.map((c) => [
      c.id,
      Object.fromEntries(
        scored.get(c.id)!.factors.map((f) => [f.key, oneDecimal(f.ratio)]),
      ) as Ratios,
    ]),
  );

  const accepted = await proposeZones(
    { industry, candidates, ratios, radiusM, locale },
    ask,
  );
  if (accepted.length === 0) throw new LocationError("no_valid_zones");

  const zones = rankZones<Zone>(
    accepted.map(({ candidate: c, explanation }) => ({
      rank: 0,
      name: c.name,
      lat: c.lat,
      lon: c.lon,
      distanceM: c.distanceM,
      ...scored.get(c.id)!,
      counts: c.counts,
      staffMin: c.staffMin,
      explanation,
      establishments: c.establishments,
    })),
  );

  return {
    source: "INEGI DENUE",
    queriedAt,
    // The DENUE API does not report its dataset edition.
    datasetDate: null,
    area: { counts: area.counts, staffMin: area.staffMin },
    zones,
  };
}
