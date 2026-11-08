import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { INDUSTRIES } from "@/lib/industries";
import { DEFAULT_LOCALE, isLocale } from "./config";
import type { LocalePreferenceStore } from "./preference";
import { resolveLocaleFrom } from "./resolve";

const store = (value: string | undefined): LocalePreferenceStore => ({
  read: async () => (isLocale(value) ? value : undefined),
  write: async () => {},
});

describe("isLocale", () => {
  it("accepts only the supported languages", () => {
    expect(isLocale("es")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("ES")).toBe(false);
    expect(isLocale("../es")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("resolveLocaleFrom", () => {
  it("defaults to Spanish", () => {
    expect(DEFAULT_LOCALE).toBe("es");
  });

  it("uses a valid stored preference", async () => {
    await expect(resolveLocaleFrom([store("en")])).resolves.toBe("en");
  });

  it("falls back to Spanish when the preference is missing or invalid", async () => {
    await expect(resolveLocaleFrom([store(undefined)])).resolves.toBe("es");
    await expect(resolveLocaleFrom([store("fr")])).resolves.toBe("es");
    await expect(resolveLocaleFrom([])).resolves.toBe("es");
  });

  it("takes the first store with a preference, so a profile store can be added in front", async () => {
    await expect(resolveLocaleFrom([store("en"), store("es")])).resolves.toBe(
      "en",
    );
    await expect(
      resolveLocaleFrom([store(undefined), store("en")]),
    ).resolves.toBe("en");
  });
});

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("messages", () => {
  it("es.json and en.json have exactly the same keys", () => {
    expect(keys(en).sort()).toEqual(keys(es).sort());
  });

  it("every message is a non-empty string", () => {
    for (const messages of [es, en]) {
      for (const key of keys(messages)) {
        const value = key
          .split(".")
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)[part],
            messages,
          );
        expect(typeof value === "string" && value.trim() !== "", key).toBe(
          true,
        );
      }
    }
  });

  it("has a display name for exactly the industry codes in INDUSTRIES", () => {
    expect(Object.keys(es.industries).sort()).toEqual([...INDUSTRIES].sort());
  });

  it("has a message for every database error contract code", () => {
    const contract = [
      "not_authenticated",
      "profile_not_found",
      "onboarding_already_completed",
      "personal_info_incomplete",
      "invalid_full_name",
      "invalid_birth_date",
      "invalid_business_name",
      "invalid_industry",
      "invalid_status",
      "business_already_exists",
    ];
    for (const code of contract) {
      expect(es.errors, code).toHaveProperty(code);
    }
  });
});
