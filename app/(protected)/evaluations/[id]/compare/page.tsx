import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageIntro } from "@/components/ui/page-intro";
import { TextLink } from "@/components/ui/text-link";
import { factorAmount, formatDistance } from "@/lib/location/format";
import { loadEvaluation } from "@/lib/location/load";
import type { FactorKey } from "@/lib/location/types";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("compare") };
}

const FACTORS: FactorKey[] = ["activity", "competition", "related", "staff"];

// SPEC-LOC-09: every zone with the same criteria, no charts.
export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await guardPage("dashboard");
  const evaluation = await loadEvaluation(supabase, (await params).id);
  if (!evaluation) notFound();
  const { id, result } = evaluation;
  const t = await getTranslations("location");
  const tc = await getTranslations();
  const format = await getFormatter();
  const n = (v: number) => format.number(v, { maximumFractionDigits: 1 });
  const zones = result.zones;
  const cell = "px-4.5 py-3.5 text-left align-top";

  return (
    <DashboardLayout
      brand={tc("common.appName")}
      signOutLabel={tc("dashboard.signOut")}
      wide
    >
      <TextLink href={`/evaluations/${id}`} className="self-start text-label">
        ← {t("detail.back")}
      </TextLink>
      <PageIntro
        title={t("compare.title")}
        description={t("compare.subtitle")}
      />
      <div className="overflow-x-auto rounded-xl border border-divider bg-white">
        <table className="w-full min-w-160 border-collapse text-label">
          <thead>
            <tr>
              <th
                scope="col"
                className={`${cell} font-medium text-ink-tertiary`}
              >
                {t("compare.criterion")}
              </th>
              {zones.map((z) => (
                <th
                  key={z.rank}
                  scope="col"
                  className={`${cell} font-semibold`}
                >
                  {z.rank} ·{" "}
                  {z.name || t("zone.fallbackName", { rank: z.rank })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-divider bg-panel">
              <th scope="row" className={`${cell} font-medium`}>
                {t("compare.score")}
              </th>
              {zones.map((z) => (
                <td key={z.rank} className={`${cell} text-lead font-medium`}>
                  {z.score}
                </td>
              ))}
            </tr>
            {FACTORS.map((key) => (
              <tr key={key} className="border-t border-divider">
                <th scope="row" className={`${cell} font-normal`}>
                  {t(`factors.${key}.name`)}
                </th>
                {zones.map((z) => {
                  const f = z.factors.find((x) => x.key === key)!;
                  return (
                    <td key={z.rank} className={cell}>
                      {f.available
                        ? t("compare.cell", {
                            points: n(f.points ?? 0),
                            ratio: f.ratio === null ? "—" : n(f.ratio),
                            count: factorAmount(z, key),
                          })
                        : t("factors.unavailable")}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-divider">
              <th scope="row" className={`${cell} font-normal`}>
                {t("compare.total")}
              </th>
              {zones.map((z) => (
                <td key={z.rank} className={cell}>
                  {z.counts.total}
                </td>
              ))}
            </tr>
            <tr className="border-t border-divider">
              <th scope="row" className={`${cell} font-normal`}>
                {t("compare.distance")}
              </th>
              {zones.map((z) => (
                <td key={z.rank} className={cell}>
                  {formatDistance(z.distanceM)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-note text-ink-tertiary">{t("compare.legend")}</p>
    </DashboardLayout>
  );
}
