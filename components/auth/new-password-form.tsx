"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import {
  updatePassword,
  type NewPasswordFormState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";

// Sets a new password after recovery (specification.md SPEC-AUTH-09).
export function NewPasswordForm() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<
    NewPasswordFormState,
    FormData
  >(updatePassword, {});
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.errors?.password) passwordRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4.5">
      {state.formError ? <FormAlert>{t(state.formError)}</FormAlert> : null}
      <TextField
        ref={passwordRef}
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        label={t("auth.update.label")}
        hint={t("auth.update.hint")}
        error={state.errors?.password ? t(state.errors.password) : undefined}
      />
      <Button type="submit" pending={pending} className="mt-1.5 w-full">
        {pending ? t("auth.update.pending") : t("auth.update.submit")}
      </Button>
    </form>
  );
}
