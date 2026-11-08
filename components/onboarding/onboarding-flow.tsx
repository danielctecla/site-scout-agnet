"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  finishOnboarding,
  savePersonalInformation,
} from "@/app/(protected)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { PageIntro } from "@/components/ui/page-intro";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { RadioCards } from "@/components/ui/radio-cards";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { INDUSTRIES } from "@/lib/industries";
import {
  validateBirthDate,
  validateBusinessName,
  validateFullName,
} from "@/lib/validation";

type Errors = Partial<Record<string, string>>;

// Two steps on one page (specification.md SPEC-ONB, SPEC-BIZ). Values live in
// state, so going back or switching language keeps them.
export function OnboardingFlow({
  initialFullName,
  initialBirthDate,
}: {
  initialFullName: string;
  initialBirthDate: string;
}) {
  const t = useTranslations();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState(initialFullName);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [establishment, setEstablishment] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // After a step change, move focus to the new heading for keyboard and screen
  // reader users.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.querySelector("h1")?.focus();
  }, [step]);

  function goTo(next: 1 | 2) {
    setErrors({});
    setFormError(undefined);
    setStep(next);
  }

  function submitPersonal(event: React.FormEvent) {
    event.preventDefault();
    const found = {
      fullName: validateFullName(fullName),
      birthDate: validateBirthDate(birthDate),
    };
    setErrors(found);
    setFormError(undefined);
    if (found.fullName || found.birthDate) return;
    startTransition(async () => {
      const { error } = await savePersonalInformation({ fullName, birthDate });
      if (error) setFormError(error);
      else goTo(2);
    });
  }

  function submitBusiness(event: React.FormEvent) {
    event.preventDefault();
    const found = {
      businessName: validateBusinessName(businessName),
      industry: industry ? undefined : "validation.industryRequired",
      establishment: establishment
        ? undefined
        : "validation.establishmentRequired",
    };
    setErrors(found);
    setFormError(undefined);
    if (found.businessName || found.industry || found.establishment) return;
    startTransition(async () => {
      const { error } = await finishOnboarding({
        businessName,
        industry,
        hasEstablishment: establishment === "yes",
      });
      if (error) setFormError(error);
    });
  }

  // Keys come from the validation helpers and the error contract.
  const message = (key?: string) =>
    key ? t(key as Parameters<typeof t>[0]) : undefined;

  return (
    <>
      <div ref={headingRef} className="flex flex-col items-center gap-5">
        <ProgressSteps
          current={step}
          total={2}
          label={t("onboarding.progress", { current: step, total: 2 })}
          name={t("onboarding.progressName")}
        />
        {step === 1 ? (
          <PageIntro
            centered
            title={t("onboarding.personal.title")}
            description={t("onboarding.personal.subtitle")}
          />
        ) : (
          <PageIntro
            centered
            title={t("onboarding.business.title")}
            description={t("onboarding.business.subtitle")}
          />
        )}
      </div>

      {step === 1 ? (
        <form
          onSubmit={submitPersonal}
          noValidate
          className="flex flex-col gap-4.5"
        >
          {formError ? <FormAlert>{message(formError)}</FormAlert> : null}
          <TextField
            id="full-name"
            autoComplete="name"
            label={t("onboarding.personal.fullName")}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            error={message(errors.fullName)}
          />
          <TextField
            id="birth-date"
            type="date"
            autoComplete="bday"
            label={t("onboarding.personal.birthDate")}
            hint={t("onboarding.personal.birthDateHint")}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            error={message(errors.birthDate)}
          />
          <Button type="submit" pending={pending} className="mt-2.5 w-full">
            {pending
              ? t("onboarding.personal.saving")
              : t("onboarding.personal.next")}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={submitBusiness}
          noValidate
          className="flex flex-col gap-5.5"
        >
          {formError ? <FormAlert>{message(formError)}</FormAlert> : null}
          <TextField
            id="business-name"
            label={t("onboarding.business.name")}
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            error={message(errors.businessName)}
          />
          <SelectField
            id="industry"
            label={t("onboarding.business.industry")}
            placeholder={t("onboarding.business.industryPlaceholder")}
            options={INDUSTRIES.map((code) => ({
              value: code,
              label: t(`industries.${code}`),
            }))}
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            error={message(errors.industry)}
          />
          <RadioCards
            name="establishment"
            legend={t("onboarding.business.establishment")}
            options={[
              {
                value: "yes",
                label: t("onboarding.business.yes"),
                description: t("onboarding.business.yesHint"),
              },
              {
                value: "no",
                label: t("onboarding.business.no"),
                description: t("onboarding.business.noHint"),
              },
            ]}
            value={establishment}
            onChange={(event) => setEstablishment(event.target.value)}
            error={message(errors.establishment)}
          />
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => goTo(1)}
            >
              {t("onboarding.business.back")}
            </Button>
            <Button type="submit" pending={pending}>
              {pending
                ? t("onboarding.business.finishing")
                : t("onboarding.business.finish")}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
