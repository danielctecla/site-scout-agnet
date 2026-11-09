import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "@fontsource-variable/inter";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: { default: t("title"), template: `%s · ${t("title")}` } };
}

// Every page depends on request cookies (session and language), so pages are
// rendered per request instead of prerendered (architecture.md §1, Cache
// Components).
export const instant = false;

// The language comes from the preference cookie (architecture.md §9), so the
// first server render is already in the right language.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full">
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
