import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Industry } from "@/lib/industries";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("dashboard") };
}

type Status = "planning" | "active";

// Greeting and the user's business card (SPEC-DASH). RLS limits both reads to
// the signed-in user.
export default async function DashboardPage() {
  const { supabase, user } = await guardPage("dashboard");
  const t = await getTranslations();
  const [{ data: profile }, { data: business }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase
      .from("businesses")
      .select("name, industry, status")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <DashboardLayout
      brand={t("common.appName")}
      signOutLabel={t("dashboard.signOut")}
    >
      <PageIntro
        title={t("dashboard.greeting", { name: profile?.full_name ?? "" })}
        description={t("dashboard.subtitle")}
      />
      {business ? (
        <section
          aria-labelledby="business-name"
          className="flex flex-col gap-6 rounded-xl border border-divider bg-white p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 id="business-name" className="text-heading break-words">
              {business.name}
            </h2>
            <StatusBadge
              status={business.status as Status}
              label={t(`status.${business.status as Status}`)}
            />
          </div>
          <dl className="flex flex-col gap-1">
            <dt className="text-note text-ink-tertiary">
              {t("dashboard.industry")}
            </dt>
            <dd className="text-body">
              {t(`industries.${business.industry as Industry}`)}
            </dd>
          </dl>
        </section>
      ) : null}
    </DashboardLayout>
  );
}
