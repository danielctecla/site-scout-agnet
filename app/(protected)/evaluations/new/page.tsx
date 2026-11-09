import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EvaluationForm } from "@/components/location/evaluation-form";
import { PageIntro } from "@/components/ui/page-intro";
import { TextLink } from "@/components/ui/text-link";
import type { Industry } from "@/lib/industries";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("evaluationNew") };
}

// The industry comes from onboarding and is never asked again (FR-14).
export default async function NewEvaluationPage() {
  const { supabase, user } = await guardPage("dashboard");
  const t = await getTranslations();
  const { data: business } = await supabase
    .from("businesses")
    .select("industry")
    .eq("user_id", user.id)
    .single();

  return (
    <DashboardLayout
      brand={t("common.appName")}
      signOutLabel={t("dashboard.signOut")}
    >
      <TextLink href="/dashboard" className="self-start text-label">
        ← {t("location.form.back")}
      </TextLink>
      <PageIntro
        title={t("location.form.title")}
        description={t("location.form.subtitle")}
      />
      <EvaluationForm
        industry={t(
          `industries.${(business?.industry ?? "other") as Industry}`,
        )}
      />
    </DashboardLayout>
  );
}
