import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ChatPanel } from "@/components/location/chat-panel";
import { Score } from "@/components/location/score";
import { ZoneMap } from "@/components/location/zone-map";
import { PageIntro } from "@/components/ui/page-intro";
import { TextLink } from "@/components/ui/text-link";
import { formatDistance, formatRadius } from "@/lib/location/format";
import { loadEvaluation } from "@/lib/location/load";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("evaluation") };
}

const action =
  "inline-flex h-10 items-center rounded-lg px-4 text-label font-medium focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";

// SPEC-LOC-07.
export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await guardPage("dashboard");
  const evaluation = await loadEvaluation(supabase, (await params).id);
  if (!evaluation) notFound();
  const { id, input, result } = evaluation;
  const t = await getTranslations();
  const format = await getFormatter();
  const name = (z: { name: string; rank: number }) =>
    z.name || t("location.zone.fallbackName", { rank: z.rank });

  return (
    <DashboardLayout
      brand={t("common.appName")}
      signOutLabel={t("dashboard.signOut")}
      wide
    >
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-7">
          <TextLink href="/evaluations/new" className="self-start text-label">
            ← {t("location.results.back")}
          </TextLink>
          <PageIntro
            title={t("location.results.title")}
            description={t("location.results.context", {
              place: input.reference.label,
              radius: formatRadius(input.radiusM),
              industry: t(`industries.${input.industry}`),
            })}
          />
          <ZoneMap
            label={t("location.results.map")}
            circles={[{ ...input.reference, radiusM: input.radiusM }]}
            reference={{
              ...input.reference,
              label: t("location.results.reference"),
            }}
            zones={result.zones.map((z) => ({
              rank: z.rank,
              name: name(z),
              lat: z.lat,
              lon: z.lon,
            }))}
          />
          <ol className="flex flex-col rounded-xl border border-divider bg-white">
            {result.zones.map((z) => (
              <li
                key={z.rank}
                className="flex flex-wrap gap-6 border-b border-divider p-6 last:border-b-0 sm:p-7"
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 flex-none items-center justify-center rounded-full bg-ink text-label font-semibold text-white"
                >
                  {z.rank}
                </span>
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
                  <h2 className="text-lead font-medium break-words">
                    {name(z)}
                  </h2>
                  <p className="text-note text-ink-tertiary">
                    {t("location.results.distance", {
                      distance: formatDistance(z.distanceM),
                    })}
                  </p>
                  <p className="text-body text-ink-secondary">
                    {z.explanation.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2.5">
                    <Link
                      href={`/evaluations/${id}/zones/${z.rank}`}
                      className={`${action} bg-ink text-white hover:bg-ink-hover`}
                    >
                      {t("location.results.detail")}
                    </Link>
                    <Link
                      href={`/evaluations/${id}/compare`}
                      className={`${action} border border-ink hover:bg-panel`}
                    >
                      {t("location.results.compare")}
                    </Link>
                  </div>
                </div>
                <Score value={z.score} label={t("location.results.score")} />
              </li>
            ))}
          </ol>
          <p className="text-note text-ink-tertiary">
            {t("location.results.source", {
              date: format.dateTime(new Date(result.queriedAt), {
                dateStyle: "long",
                timeStyle: "short",
              }),
            })}
          </p>
        </div>
        <ChatPanel evaluationId={id} />
      </div>
    </DashboardLayout>
  );
}
