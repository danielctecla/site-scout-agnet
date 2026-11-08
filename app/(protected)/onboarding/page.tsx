import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OnboardingLayout } from "@/components/layout/onboarding-layout";
import { PageIntro } from "@/components/ui/page-intro";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("onboarding") };
}

// Placeholder until TASK-014 builds the form.
export default async function OnboardingPage() {
  await guardPage("onboarding");
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
