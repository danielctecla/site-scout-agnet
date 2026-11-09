import { describe, expect, it } from "vitest";
import { parseEvaluationInput, parseRent } from "./input";

describe("parseRent", () => {
  it("accepts an empty value or a whole amount", () => {
    expect(parseRent("")).toBeNull();
    expect(parseRent(" $25,000 ")).toBe(25000);
    for (const bad of ["0", "12.5", "-3", "abc", "10000001"]) {
      expect(parseRent(bad), bad).toBeUndefined();
    }
  });
});

describe("parseEvaluationInput", () => {
  const form = {
    reference: { label: " Roma Norte ", lat: 19.4194, lon: -99.1617 },
    radiusM: 1000,
    rentMxn: null,
  };

  it("takes the industry from the business, never from the form", () => {
    expect(parseEvaluationInput(form, "retail")).toEqual({
      reference: { label: "Roma Norte", lat: 19.4194, lon: -99.1617 },
      radiusM: 1000,
      rentMxn: null,
      industry: "retail",
    });
  });

  it("rejects places outside Mexico, unknown radii and invalid rent", () => {
    for (const bad of [
      { ...form, reference: { ...form.reference, lat: 40.4 } },
      { ...form, reference: { ...form.reference, label: "" } },
      { ...form, radiusM: 750 },
      { ...form, rentMxn: 0.5 },
    ]) {
      expect(parseEvaluationInput(bad, "retail")).toBeNull();
    }
  });
});
