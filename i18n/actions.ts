"use server";

import { isLocale } from "./config";
import { LOCALE_STORES } from "./resolve";

// Saves the language preference in every configured store. Invalid values are
// ignored; nothing about the language is written to the database.
export async function setLocalePreference(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  for (const store of LOCALE_STORES) {
    await store.write(locale);
  }
}
