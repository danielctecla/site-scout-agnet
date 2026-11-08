import { getTranslations } from "next-intl/server";
import { LanguageSelector } from "@/components/language-selector";

// Placeholder. TASK-013 replaces this page with the redirect described in
// specification.md SPEC-ROUTE-05.
export default async function Home() {
  const t = await getTranslations("common");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6">
      <h1 className="text-display">{t("appName")}</h1>
      <LanguageSelector />
    </main>
  );
}
