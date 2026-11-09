import { describe, expect, it } from "vitest";
import { allowedNumbers, proposeZones, validateProposal } from "./agent";
import type { Candidate } from "./zones";

const RADIUS_M = 1000;

function candidate(
  id: string,
  lat: number,
  extra: Partial<Candidate> = {},
): Candidate {
  return {
    id,
    lat,
    lon: -99.1617,
    distanceM: 450,
    counts: { total: 40, same: 6, related: 9, other: 25 },
    staffMin: 120,
    staffKnown: 38,
    name: "Roma Norte · Calle Orizaba",
    topActivities: [{ activity: "Restaurantes", count: 12 }],
    establishments: [],
    ...extra,
  };
}

// c1 and c2 are 110 m apart; c3 is 1.1 km from c1.
const CANDIDATES = [
  candidate("c1", 19.42),
  candidate("c2", 19.421),
  candidate("c3", 19.43),
];
const ratios = (
  activity: number,
  competition: number,
  related: number,
  staff: number | null,
) => ({
  activity,
  competition,
  related,
  staff,
});
const RATIOS = {
  c1: ratios(1.6, 0.4, 1.2, 0.8),
  c2: ratios(1, 1, 1, 1),
  c3: ratios(2.1, 0.2, 1.5, null),
};
const ctx = { candidates: CANDIDATES, ratios: RATIOS, radiusM: RADIUS_M };

const zone = (
  candidateId: string,
  text = "Hay 6 competidores y 9 negocios relacionados.",
) => ({
  candidateId,
  summary: text,
  opportunities: [text],
  considerations: ["DENUE no informa el flujo peatonal."],
  conclusion: "Zona con actividad comercial alta.",
});

describe("allowedNumbers", () => {
  it("contains the zone's metrics, the radii and nothing else", () => {
    const numbers = allowedNumbers(CANDIDATES[0], RATIOS.c1, RADIUS_M);
    for (const n of [
      40, 6, 9, 25, 120, 450, 12, 1.6, 0.4, 1.2, 0.8, 300, 1000, 1,
    ]) {
      expect(numbers.has(n), String(n)).toBe(true);
    }
    expect(numbers.has(7)).toBe(false);
    // Numbers in names the agent may repeat ("Calle 5 de Mayo").
    const named = candidate("c9", 19.42, { name: "Centro · Calle 5 de Mayo" });
    expect(allowedNumbers(named, RATIOS.c1, RADIUS_M).has(5)).toBe(true);
  });
});

describe("validateProposal", () => {
  it("accepts zones backed by candidates, in the agent's order", () => {
    const accepted = validateProposal({ zones: [zone("c3"), zone("c1")] }, ctx);
    expect(accepted?.map((z) => z.candidate.id)).toEqual(["c3", "c1"]);
    expect(accepted?.[0].explanation.summary).toContain("6 competidores");
  });

  it("returns null when the response breaks the schema", () => {
    for (const bad of [
      null,
      "texto",
      { zones: "c1" },
      { zones: [{ candidateId: "c1" }] },
      { zones: [zone("c1"), zone("c2"), zone("c3"), zone("c1")] },
    ]) {
      expect(validateProposal(bad, ctx), JSON.stringify(bad)).toBeNull();
    }
  });

  it("drops unknown candidates and zones within 400 m of an accepted one", () => {
    const accepted = validateProposal(
      { zones: [zone("c1"), zone("c2"), zone("c99")] },
      ctx,
    );
    expect(accepted?.map((z) => z.candidate.id)).toEqual(["c1"]);
  });

  it("drops a zone whose text has a number that is not one of its metrics", () => {
    const invented = zone("c1", "Hay 7 competidores y 2,500 personas al día.");
    const decimal = zone("c3", "La competencia es 0,2 veces la del área.");
    const accepted = validateProposal({ zones: [invented, decimal] }, ctx);
    expect(accepted?.map((z) => z.candidate.id)).toEqual(["c3"]);
  });

  it("accepts an empty proposal", () => {
    expect(validateProposal({ zones: [] }, ctx)).toEqual([]);
  });
});

describe("proposeZones", () => {
  const input = { industry: "food_beverage" as const, ...ctx };

  it("retries once when the first response breaks the schema", async () => {
    const replies = [{ wrong: true }, { zones: [zone("c1")] }];
    let calls = 0;
    const ask = async () => replies[calls++];
    const accepted = await proposeZones(input, ask);
    expect(calls).toBe(2);
    expect(accepted.map((z) => z.candidate.id)).toEqual(["c1"]);
  });

  it("fails with analysis_failed after two invalid responses", async () => {
    await expect(proposeZones(input, async () => ({}))).rejects.toMatchObject({
      key: "analysis_failed",
    });
  });

  it("sends metrics but never scores to the agent", async () => {
    let prompt = "";
    await proposeZones(input, async (p) => {
      prompt = p;
      return { zones: [] };
    });
    expect(prompt).toContain('"id": "c1"');
    expect(prompt).not.toMatch(/score|puntuaci/i);
  });
});
