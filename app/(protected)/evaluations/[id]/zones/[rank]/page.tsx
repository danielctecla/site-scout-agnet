import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ChatPanel } from "@/components/location/chat-panel";
import { ZoneMap } from "@/components/location/zone-map";
import { TextLink } from "@/components/ui/text-link";
import { factorAmount, formatDistance, maxPoints } from "@/lib/location/format";
import { loadEvaluation } from "@/lib/location/load";
import { distanceM } from "@/lib/location/zones";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("zone") };
}

const action =
  "inline-flex h-10 items-center rounded-lg px-3.5 text-label focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";

function Card({
  title,
  hint,
  id,
  children,
}: {
  title: string;
  hint?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="flex scroll-mt-6 flex-col gap-5 rounded-xl border border-divider bg-white p-6 sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-label font-semibold">{title}</h2>
        {hint ? <p className="text-note text-ink-tertiary">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

// SPEC-LOC-08, sections 1–8.
export default async function ZonePage({
  params,
}: {
  params: Promise<{ id: string; rank: string }>;
}) {
  const { supabase } = await guardPage("dashboard");
  const { id, rank } = await params;
  const evaluation = await loadEvaluation(supabase, id);
  const zone = evaluation?.result.zones.find((z) => String(z.rank) === rank);
  if (!evaluation || !zone) notFound();
  const { input, result } = evaluation;
  const t = await getTranslations("location");
  const tc = await getTranslations();
  const format = await getFormatter();
  const n = (v: number) => format.number(v, { maximumFractionDigits: 1 });
  const name = zone.name || t("zone.fallbackName", { rank: zone.rank });
  const date = format.dateTime(new Date(result.queriedAt), {
    dateStyle: "long",
  });
  const establishments = zone.establishments
    .map((e) => ({ ...e, distance: distanceM(zone, e) }))
    .sort((a, b) => a.distance - b.distance);

  return (
    <DashboardLayout
      brand={tc("common.appName")}
      signOutLabel={tc("dashboard.signOut")}
      wide
    >
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-7">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            <TextLink href={`/evaluations/${id}`} className="text-label">
              ← {t("detail.back")}
            </TextLink>
            <div className="flex flex-wrap gap-2">
              <a
                href="#establishments"
                className={`${action} border border-border bg-white hover:bg-panel`}
              >
                {t("detail.viewEstablishments")}
              </a>
              <Link
                href={`/evaluations/${id}/compare`}
                className={`${action} border border-ink font-medium hover:bg-panel`}
              >
                {t("detail.compare")}
              </Link>
              <a
                href="#agent-question"
                className={`${action} hidden bg-ink font-medium text-white hover:bg-ink-hover lg:inline-flex`}
              >
                {t("detail.ask")}
              </a>
            </div>
          </nav>

          <header className="flex flex-col gap-2.5">
            <p className="text-note font-medium text-ink-tertiary">
              {t("detail.alternative", {
                rank: zone.rank,
                total: result.zones.length,
              })}
            </p>
            <h1 tabIndex={-1} className="text-display break-words outline-none">
              {name}
            </h1>
            <p className="text-body text-ink-secondary">
              {t("detail.location", {
                distance: formatDistance(zone.distanceM),
                lat: zone.lat.toFixed(4),
                lon: zone.lon.toFixed(4),
              })}
            </p>
          </header>

          <Card title={t("detail.scoreTitle")} hint={t("detail.scoreHint")}>
            <p className="text-display leading-none">
              {zone.score}
              <span className="text-lead tracking-normal text-ink-tertiary">
                {" "}
                /100
              </span>
            </p>
            <ul className="flex flex-col">
              {zone.factors.map((f) => {
                const max = maxPoints(zone, f.weight);
                const copy = (k: string) =>
                  t(`factors.${f.key}.${k}` as "factors.activity.name");
                const data = !f.available
                  ? f.key === "staff"
                    ? t("factors.unavailableStaff")
                    : t("factors.unavailableIndustry")
                  : f.ratio === null
                    ? t(`factors.${f.key}.none` as "factors.competition.none", {
                        count: factorAmount(zone, f.key),
                      })
                    : t(`factors.${f.key}.data`, {
                        count: factorAmount(zone, f.key),
                        ratio: n(f.ratio),
                      });
                return (
                  <li
                    key={f.key}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 border-t border-divider py-4.5 last:pb-0"
                  >
                    <span className="text-body font-medium">
                      {copy("name")}
                    </span>
                    <span className="text-body font-medium">
                      {f.available
                        ? t("detail.points", {
                            points: n(f.points ?? 0),
                            max: n(max),
                          })
                        : t("factors.unavailable")}
                    </span>
                    <span className="text-label text-ink-secondary">
                      {copy("measures")} {data}
                    </span>
                    {f.available ? (
                      <span
                        aria-hidden="true"
                        className="h-1 w-40 self-center rounded-full bg-divider"
                      >
                        <span
                          className="block h-1 rounded-full bg-ink"
                          style={{
                            width: `${Math.round((100 * (f.points ?? 0)) / max)}%`,
                          }}
                        />
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="col-span-2 text-note text-ink-tertiary">
                      {copy("limit")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title={t("detail.mapTitle")}>
            <ZoneMap
              label={t("detail.map")}
              circles={[{ lat: zone.lat, lon: zone.lon, radiusM: 300 }]}
              zones={[{ rank: zone.rank, name, lat: zone.lat, lon: zone.lon }]}
              establishments={establishments.map((e) => ({
                lat: e.lat,
                lon: e.lon,
                same: e.category === "same",
                lines: [
                  e.name,
                  e.activity,
                  e.address,
                  t("detail.markerDistance", {
                    distance: formatDistance(e.distance),
                    id: e.id,
                  }),
                ],
              }))}
            />
            <ul className="flex flex-wrap gap-5 text-note text-ink-secondary">
              <li className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full bg-ink"
                />
                {t("detail.legendSame")}
              </li>
              <li className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full border-2 border-ink-tertiary bg-white"
                />
                {t("detail.legendOther")}
              </li>
              <li className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-3.5 rounded-full border-2 border-dashed border-ink-tertiary"
                />
                {t("detail.legendRadius")}
              </li>
            </ul>
          </Card>

          <Card title={t("detail.whyTitle")} hint={t("detail.whyHint")}>
            {(["opportunities", "considerations"] as const).map((key) => (
              <div key={key} className="flex flex-col gap-2">
                <h3 className="text-label font-semibold">
                  {t(`detail.${key}`)}
                </h3>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body text-ink-secondary">
                  {zone.explanation[key].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <h3 className="text-label font-semibold">
                {t("detail.conclusion")}
              </h3>
              <p className="text-body text-ink-secondary">
                {zone.explanation.conclusion}
              </p>
            </div>
          </Card>

          <Card id="establishments" title={t("detail.establishmentsTitle")}>
            <dl className="grid grid-cols-3 rounded-lg border border-divider">
              {(["same", "related", "other"] as const).map((key) => (
                <div
                  key={key}
                  className="border-r border-divider px-4.5 py-4 last:border-r-0"
                >
                  <dt className="text-note text-ink-tertiary">
                    {t(`counts.${key}`)}
                  </dt>
                  <dd className="mt-1 text-heading">{zone.counts[key]}</dd>
                </div>
              ))}
            </dl>
            <details className="group">
              <summary className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-ink px-3.5 text-label font-medium hover:bg-panel">
                {t("detail.showAll", { count: zone.counts.total })}
              </summary>
              <div className="mt-4 overflow-x-auto rounded-lg border border-divider">
                <table className="w-full border-collapse text-note">
                  <thead className="bg-panel text-left">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium">
                        {t("detail.name")}
                      </th>
                      <th className="px-3.5 py-2.5 font-medium">
                        {t("detail.activity")}
                      </th>
                      <th className="px-3.5 py-2.5 font-medium">
                        {t("detail.category")}
                      </th>
                      <th className="px-3.5 py-2.5 text-right font-medium">
                        {t("detail.distanceColumn")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {establishments.map((e) => (
                      <tr key={e.id} className="border-t border-divider">
                        <td className="px-3.5 py-2.5">{e.name}</td>
                        <td className="px-3.5 py-2.5 text-ink-secondary">
                          {e.activity}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {t(`category.${e.category}`)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          {formatDistance(e.distance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>

          <section className="grid rounded-xl border border-divider bg-white sm:grid-cols-2">
            <div className="flex flex-col gap-2 border-divider p-6 max-sm:border-b sm:border-r sm:p-8">
              <h2 className="text-label font-semibold">
                {t("detail.sourceTitle")}
              </h2>
              <p className="text-label text-ink-secondary">
                {t("detail.sourceText", { date })}
              </p>
              <p className="text-note text-ink-tertiary">
                {t("detail.limitations")}
              </p>
            </div>
            <div className="flex flex-col gap-2 p-6 sm:p-8">
              <h2 className="text-label font-semibold">
                {t("detail.rentTitle")}
              </h2>
              {input.rentMxn === null ? (
                <p className="text-body text-ink-secondary">
                  {t("detail.rentMissing")}
                </p>
              ) : (
                <>
                  <p className="text-heading">
                    {format.number(input.rentMxn, {
                      style: "currency",
                      currency: "MXN",
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p className="text-note text-ink-tertiary">
                    {t("detail.rentEntered")}
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
        <ChatPanel evaluationId={id} />
      </div>
    </DashboardLayout>
  );
}
