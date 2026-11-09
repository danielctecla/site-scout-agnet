import type { Locale } from "./i18n/config";
import type messages from "./messages/es.json";

// Message keys and locales are typed from the Spanish source file
// (architecture.md §9).
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
