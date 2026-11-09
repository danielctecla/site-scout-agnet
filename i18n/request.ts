import { getRequestConfig } from "next-intl/server";
import en from "../messages/en.json";
import es from "../messages/es.json";
import type { Locale } from "./config";
import { resolveLocale } from "./resolve";

type Messages = Record<string, unknown>;

// Spanish is the source file. English is layered over it, so a missing key
// falls back to Spanish (the key parity test keeps this from happening).
function withFallback(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = base[key];
    result[key] =
      isObject(value) && isObject(baseValue)
        ? withFallback(baseValue, value)
        : value;
  }
  return result;
}

function isObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MESSAGES: Record<Locale, Messages> = {
  es,
  en: withFallback(es, en),
};

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, messages: MESSAGES[locale] };
});
