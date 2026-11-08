import { describe, expect, it } from "vitest";
import { rankZones, scoreZone } from "./scoring";
import type { Metrics } from "./zones";

// Zone circle: 300 m; area: 1 km radius → the area is 11.1× the zone, so a
// zone with 1/11.1 of the area's establishments has the same density.
const metrics = (
  total: number,
  same: number,
  related: number,
  staffMin = 0,
  staffKnown = 0,
): Metrics => ({
  counts: { total, same, related, other: total - same - related },
  staffMin,
  staffKnown,
});
const AREA = metrics(1111, 111, 111, 1111, 1000);
const score = (zone: Metrics, area = AREA, classified = true) =>
  scoreZone(zone, area, { radiusM: 1000, classified });
const factor = (r: ReturnType<typeof scoreZone>, key: string) =>
  r.factors.find((f) => f.key === key)!;

describe("scoreZone", () => {
  it("scores density against the area average, capped at twice", () => {
    expect(factor(score(metrics(100, 0, 0)), "activity").value).toBeCloseTo(
      0.5,
      2,
    );
    expect(factor(score(metrics(400, 0, 0)), "activity").value).toBe(1);
  });

  it("rewards less competition and more related businesses", () => {
    const quiet = score(metrics(100, 0, 20));
    const crowded = score(metrics(100, 40, 0));
    expect(factor(quiet, "competition").value).toBe(1);
    expect(factor(crowded, "competition").value).toBe(0);
    expect(factor(quiet, "related").value).toBe(1);
    expect(quiet.score).toBeGreaterThan(crowded.score);
  });

  it("treats an area without competitors or related businesses as data", () => {
    const r = score(metrics(100, 0, 0), metrics(1111, 0, 0, 1111, 1000));
    expect(factor(r, "competition")).toMatchObject({
      available: true,
      ratio: null,
      value: 1,
    });
    expect(factor(r, "related")).toMatchObject({
      available: true,
      ratio: null,
      value: 0,
    });
  });

  it("leaves out factors without data and their weight", () => {
    const r = score(metrics(400, 0, 0, 400, 400), AREA, false);
    expect(factor(r, "competition")).toMatchObject({
      available: false,
      value: null,
      points: null,
    });
    expect(factor(r, "related").available).toBe(false);
    // activity 1 and staff 1 → full score over the remaining weight.
    expect(r.score).toBe(100);
    expect(
      factor(score(metrics(100, 0, 0), metrics(1111, 0, 0)), "staff").available,
    ).toBe(false);
  });

  it("splits the score into factor contributions", () => {
    const r = score(metrics(150, 10, 15, 120, 100));
    const total = r.factors.reduce((sum, f) => sum + (f.points ?? 0), 0);
    expect(Math.abs(total - r.score)).toBeLessThanOrEqual(0.5);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(score(metrics(150, 10, 15, 120, 100))).toEqual(r);
  });
});

describe("rankZones", () => {
  it("sorts by score, then by distance, and numbers the zones", () => {
    const zones = [
      { score: 60, distanceM: 900, rank: 0 },
      { score: 80, distanceM: 500, rank: 0 },
      { score: 60, distanceM: 300, rank: 0 },
    ];
    expect(rankZones(zones).map((z) => [z.score, z.distanceM, z.rank])).toEqual(
      [
        [80, 500, 1],
        [60, 300, 2],
        [60, 900, 3],
      ],
    );
  });
});
