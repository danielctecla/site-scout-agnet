import { cookies } from "next/headers";
import { isLocale, type Locale } from "./config";

// Where the language preference is stored (architecture.md §9). Only this
// module, resolve.ts and actions.ts know about storage; moving the preference
// to the user's profile later means adding a store here.
export interface LocalePreferenceStore {
  read(): Promise<Locale | undefined>;
  write(locale: Locale): Promise<void>;
}

export const LOCALE_COOKIE = "locale";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// MVP store: a first-party cookie, so the server renders the right language
// on the first request. No Secure attribute: the app runs on http://localhost.
export const cookieLocaleStore: LocalePreferenceStore = {
  async read() {
    const value = (await cookies()).get(LOCALE_COOKIE)?.value;
    return isLocale(value) ? value : undefined;
  },
  async write(locale) {
    (await cookies()).set(LOCALE_COOKIE, locale, {
      path: "/",
      sameSite: "lax",
      maxAge: ONE_YEAR_SECONDS,
      httpOnly: true,
    });
  },
};
