import { describe, expect, it } from "vitest";
import { classify, hasClassification } from "./classification";
import type { DenueEstablishment } from "./types";
import { buildCandidates, distanceM, ZONE_RADIUS_M } from "./zones";

const REF = { lat: 19.4194, lon: -99.1617 };
const M_PER_DEG = 111_195;

// An establishment `north` and `east` meters from the reference.
let next = 0;
function at(
  north: number,
  east: number,
  extra: Partial<DenueEstablishment> = {},
): DenueEstablishment {
  next += 1;
  return {
    id: String(next),
    name: `Negocio ${next}`,
    activity: "Restaurantes",
    scian: "722511",
    address: "",
    colonia: "ROMA NORTE",
    street: "CALLE ORIZABA",
    lat: REF.lat + north / M_PER_DEG,
    lon: REF.lon + east / (M_PER_DEG * Math.cos((REF.lat * Math.PI) / 180)),
    staffMin: 6,
    staffLabel: "6 a 10 personas",
    ...extra,
  };
}

describe("classify", () => {
  it("uses the industry's SCIAN prefixes", () => {
    expect(classify("722514", "food_beverage")).toBe("same");
    expect(classify("461110", "food_beverage")).toBe("related");
    expect(classify("541110", "food_beverage")).toBe("other");
    expect(classify(null, "food_beverage")).toBe("other");
    expect(classify("812110", "beauty_personal_care")).toBe("same");
  });

  it("has no mapping for other", () => {
    expect(hasClassification("other")).toBe(false);
    expect(classify("722514", "other")).toBe("other");
  });
});

describe("distanceM", () => {
  it("measures great-circle distance", () => {
    const d = distanceM(REF, { lat: REF.lat + 0.01, lon: REF.lon });
    expect(d).toBeCloseTo(1112, 0);
  });
});

describe("buildCandidates", () => {
  // 12 establishments 850 m north; 8 spread south-west; one beyond the
  // radius but within the zone; one far away.
  const data = [
    ...Array.from({ length: 12 }, (_, i) =>
      at(850 + i, 50, i < 3 ? { scian: "461110" } : {}),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      at(-600, -600 + i * 150, { scian: "541110", staffMin: null }),
    ),
    at(1100, 50),
    at(5000, 5000),
  ];
  const { area, candidates } = buildCandidates(
    data,
    { ...REF, radiusM: 1000 },
    "food_beverage",
  );

  it("counts the exploration area only", () => {
    expect(area.counts).toEqual({ total: 20, same: 9, related: 3, other: 8 });
    expect(area.staffMin).toBe(72);
    expect(area.staffKnown).toBe(12);
  });

  it("makes a candidate of each cell with at least 10 establishments", () => {
    expect(candidates).toHaveLength(1);
    const [c] = candidates;
    expect(distanceM(REF, c)).toBeCloseTo(Math.hypot(855.5, 50), -1);
  });

  it("measures the zone within 300 m of the candidate center", () => {
    const [c] = candidates;
    // The cluster plus the establishment beyond the radius (≈ 245 m away).
    expect(c.counts).toEqual({ total: 13, same: 10, related: 3, other: 0 });
    expect(
      c.establishments.every((e) => distanceM(c, e) <= ZONE_RADIUS_M),
    ).toBe(true);
    expect(c.name).toBe("Roma Norte · Calle Orizaba");
    expect(c.topActivities).toEqual([{ activity: "Restaurantes", count: 13 }]);
  });

  it("is deterministic", () => {
    const again = buildCandidates(
      [...data].reverse(),
      { ...REF, radiusM: 1000 },
      "food_beverage",
    );
    expect(again.candidates).toEqual(candidates);
  });

  it("reports insufficient data with the counts found", () => {
    expect(() =>
      buildCandidates(
        data.slice(0, 5),
        { ...REF, radiusM: 1000 },
        "food_beverage",
      ),
    ).toThrow(
      expect.objectContaining({
        key: "insufficient_data",
        details: { establishments: 5, candidates: 0 },
      }),
    );
  });
});
