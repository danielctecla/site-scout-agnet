import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";
import {
  type DenueEstablishment,
  type EvaluationInput,
  LocationError,
} from "./types";

const REF = { lat: 19.4194, lon: -99.1617 };
const M = 111_195;
let next = 0;
const at = (
  north: number,
  east: number,
  scian = "722511",
): DenueEstablishment => {
  next += 1;
  return {
    id: String(next),
    name: `Negocio ${next}`,
    activity: "Restaurantes",
    scian,
    address: "",
    colonia: "ROMA NORTE",
    street: "CALLE ORIZABA",
    lat: REF.lat + north / M,
    lon: REF.lon + east / (M * Math.cos((REF.lat * Math.PI) / 180)),
    staffMin: 6,
    staffLabel: "6 a 10 personas",
  };
};
// Two clusters 1.2 km apart, both inside a 1 km radius.
const DATA = [
  ...Array.from({ length: 15 }, (_, i) =>
    at(600 + i, 50, i < 10 ? "722511" : "461110"),
  ),
  ...Array.from({ length: 12 }, (_, i) => at(-600 - i, 50, "541110")),
];
const INPUT: EvaluationInput = {
  reference: { label: "Roma Norte, CDMX", ...REF },
  radiusM: 1000,
  rentMxn: null,
  industry: "food_beverage",
};

const idsIn = (prompt: string): string[] =>
  JSON.parse(prompt.slice(prompt.indexOf("{"))).candidates.map(
    (c: { id: string }) => c.id,
  );
const explain = (candidateId: string) => ({
  candidateId,
  summary: "Zona con actividad comercial.",
  opportunities: ["Hay negocios relacionados."],
  considerations: ["DENUE no informa rentas."],
  conclusion: "Puede funcionar.",
});
const deps = (pick: (ids: string[]) => string[], data = DATA) => ({
  fetchEstablishments: async () => data,
  ask: async (prompt: string) => ({ zones: pick(idsIn(prompt)).map(explain) }),
  now: () => new Date("2026-11-08T12:00:00Z"),
});

describe("evaluate", () => {
  it("returns the agent's valid zones, scored by the system and sorted", async () => {
    const result = await evaluate(
      INPUT,
      deps((ids) => ids),
    );
    expect(result).toMatchObject({
      source: "INEGI DENUE",
      queriedAt: "2026-11-08T12:00:00.000Z",
      datasetDate: null,
      area: { counts: { total: 27, same: 10, related: 5, other: 12 } },
    });
    expect(result.zones.map((z) => z.rank)).toEqual([1, 2]);
    expect(result.zones[0].score).toBeGreaterThanOrEqual(result.zones[1].score);
    expect(result.zones[0].factors).toHaveLength(4);
    expect(result.zones[0].name).toBe("Roma Norte · Calle Orizaba");
  });

  it("asks DENUE for the radius plus the zone radius", async () => {
    let radius = 0;
    await evaluate(INPUT, {
      ...deps((ids) => ids),
      fetchEstablishments: async (p: { radiusM: number }) => {
        radius = p.radiusM;
        return DATA;
      },
    });
    expect(radius).toBe(1300);
  });

  it("shows one zone when only one is valid", async () => {
    const result = await evaluate(
      INPUT,
      deps((ids) => [ids[0], "c99_99"]),
    );
    expect(result.zones).toHaveLength(1);
  });

  it("fails with no_valid_zones, insufficient_data or the DENUE error", async () => {
    await expect(
      evaluate(
        INPUT,
        deps(() => []),
      ),
    ).rejects.toMatchObject({
      key: "no_valid_zones",
    });
    await expect(
      evaluate(
        INPUT,
        deps((ids) => ids, DATA.slice(0, 8)),
      ),
    ).rejects.toMatchObject({ key: "insufficient_data" });
    await expect(
      evaluate(INPUT, {
        ...deps((ids) => ids),
        fetchEstablishments: async () => {
          throw new LocationError("denue_unavailable");
        },
      }),
    ).rejects.toMatchObject({ key: "denue_unavailable" });
  });

  it("never uses rent in the score", async () => {
    const without = await evaluate(
      INPUT,
      deps((ids) => ids),
    );
    const withRent = await evaluate(
      { ...INPUT, rentMxn: 25_000 },
      deps((ids) => ids),
    );
    expect(withRent.zones).toEqual(without.zones);
  });
});
