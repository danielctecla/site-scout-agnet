import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OnboardingLayout } from "@/components/layout/onboarding-layout";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("onboarding") };
}

// Always starts at step 1, pre-filled with saved values (FR-12).
export default async function OnboardingPage() {
  const { supabase, user } = await guardPage("onboarding");
  const t = await getTranslations("common");
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, birth_date")
    .eq("id", user.id)
    .single();

  return (
    <OnboardingLayout brand={t("appName")}>
      <OnboardingFlow
        initialFullName={profile?.full_name ?? ""}
        initialBirthDate={profile?.birth_date ?? ""}
      />
    </OnboardingLayout>
  );
}
