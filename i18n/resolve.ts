import { DEFAULT_LOCALE, type Locale } from "./config";
import { cookieLocaleStore, type LocalePreferenceStore } from "./preference";

// Stores in priority order. A future profile store goes first (architecture.md
// §9, Future Migration).
export const LOCALE_STORES: LocalePreferenceStore[] = [cookieLocaleStore];

// Returns the first valid preference, otherwise Spanish.
export async function resolveLocaleFrom(
  stores: LocalePreferenceStore[],
): Promise<Locale> {
  for (const store of stores) {
    const locale = await store.read();
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export function resolveLocale(): Promise<Locale> {
  return resolveLocaleFrom(LOCALE_STORES);
}
