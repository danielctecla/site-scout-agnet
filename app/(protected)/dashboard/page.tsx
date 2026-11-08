import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageIntro } from "@/components/ui/page-intro";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("dashboard") };
}

// Dashboard shell (TASK-013). TASK-016 adds the business card.
export default async function DashboardPage() {
  const { supabase, user } = await guardPage("dashboard");
  const t = await getTranslations();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <DashboardLayout
      brand={t("common.appName")}
      signOutLabel={t("dashboard.signOut")}
    >
      <PageIntro
        title={t("dashboard.greeting", { name: profile?.full_name ?? "" })}
        description={t("dashboard.subtitle")}
      />
    </DashboardLayout>
  );
}
