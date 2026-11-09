"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  type ActionError,
  findPlaces,
  runEvaluation,
} from "@/app/(protected)/evaluations/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import { formatRadius } from "@/lib/location/format";
import type { Place } from "@/lib/location/geocode";
import { parseRent } from "@/lib/location/input";
import { RADII_M, type RadiusM } from "@/lib/location/types";

// SPEC-LOC-02, SPEC-LOC-03. Values live in state, so an error never clears
// the form and Retry resubmits the same values.
export function EvaluationForm({ industry }: { industry: string }) {
  const t = useTranslations("location");
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<number>();
  const [radiusM, setRadiusM] = useState<RadiusM>(1000);
  const [rent, setRent] = useState("");
  const [searchError, setSearchError] = useState<string>();
  const [rentError, setRentError] = useState<string>();
  const [failure, setFailure] = useState<ActionError>();
  const [searching, startSearch] = useTransition();
  const [pending, startEvaluation] = useTransition();

  function search() {
    setSearchError(undefined);
    if (!query.trim()) return setSearchError(t("form.placeRequired"));
    startSearch(async () => {
      const result = await findPlaces(query);
      if ("error" in result) {
        setPlaces([]);
        setSelected(undefined);
        setSearchError(t(`errors.${result.error}`));
      } else {
        setPlaces(result.places);
        setSelected(0);
      }
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const place = selected === undefined ? undefined : places[selected];
    const rentMxn = parseRent(rent);
    setSearchError(place ? undefined : t("form.placeRequired"));
    setRentError(rentMxn === undefined ? t("form.rentInvalid") : undefined);
    setFailure(undefined);
    if (!place || rentMxn === undefined) return;
    startEvaluation(async () => {
      const error = await runEvaluation({
        reference: { label: place.label, lat: place.lat, lon: place.lon },
        radiusM,
        rentMxn,
      });
      setFailure(error);
    });
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-6.5 rounded-xl border border-divider bg-white p-6 sm:p-8"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-divider pb-5">
        <span className="text-note text-ink-tertiary">
          {t("form.industry")}
        </span>
        <span className="text-label font-medium">{industry}</span>
      </div>

      {failure ? (
        <FormAlert>{t(`errors.${failure.error}`, failure.details)}</FormAlert>
      ) : null}

      <div className="flex flex-col gap-3">
        <TextField
          id="place"
          label={t("form.place")}
          hint={t("form.placeHint")}
          error={searchError}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
        />
        <Button
          variant="secondary"
          pending={searching}
          onClick={search}
          className="self-start"
        >
          {searching ? t("form.searching") : t("form.search")}
        </Button>
        {places.length > 0 ? (
          <fieldset className="overflow-hidden rounded-lg border border-border">
            <legend className="sr-only">{t("form.results")}</legend>
            {places.map((place, i) => (
              <label
                key={`${place.lat},${place.lon}`}
                className="flex cursor-pointer items-start gap-3 border-b border-divider px-4 py-3.5 last:border-b-0 has-checked:bg-panel"
              >
                <input
                  type="radio"
                  name="place"
                  checked={selected === i}
                  onChange={() => setSelected(i)}
                  className="mt-1 accent-ink"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-label font-medium">{place.name}</span>
                  <span className="text-note text-ink-tertiary">
                    {place.label}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-label font-medium">
          {t("form.radius")}
        </legend>
        <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-border">
          {RADII_M.map((r) => (
            <label
              key={r}
              className="flex h-11 cursor-pointer items-center justify-center border-r border-border text-label last:border-r-0 has-checked:bg-ink has-checked:font-medium has-checked:text-white has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-white"
            >
              <input
                type="radio"
                name="radius"
                value={r}
                checked={radiusM === r}
                onChange={() => setRadiusM(r)}
                className="sr-only"
              />
              {formatRadius(r)}
            </label>
          ))}
        </div>
      </fieldset>

      <TextField
        id="rent"
        inputMode="numeric"
        label={t("form.rent")}
        hint={t("form.rentHint")}
        error={rentError}
        value={rent}
        onChange={(event) => setRent(event.target.value)}
      />

      <div className="flex flex-col gap-2.5">
        <Button type="submit" pending={pending} className="w-full">
          {pending
            ? t("form.submitting")
            : failure
              ? t("form.retry")
              : t("form.submit")}
        </Button>
        <p className="text-center text-note text-ink-tertiary">
          {t("form.duration")}
        </p>
      </div>
    </form>
  );
}
