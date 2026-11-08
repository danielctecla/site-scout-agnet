import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OnboardingLayout } from "@/components/layout/onboarding-layout";
import { PageIntro } from "@/components/ui/page-intro";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("onboarding") };
}

// Placeholder so registration lands on a real page. TASK-014 builds the form
// and TASK-013 adds route protection.
export default async function OnboardingPage() {
  const t = await getTranslations();
  return (
    <OnboardingLayout brand={t("common.appName")}>
      <PageIntro
        centered
        title={t("onboarding.personal.title")}
        description={t("onboarding.personal.subtitle")}
      />
    </OnboardingLayout>
  );
}
