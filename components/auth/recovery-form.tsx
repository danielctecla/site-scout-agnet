"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  requestPasswordReset,
  type RecoveryFormState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { RecoveryErrorKey } from "@/lib/routing";

// Requests a recovery link. Once sent, the form is replaced by the same
// neutral confirmation for any address (specification.md SPEC-AUTH-07).
// `linkError` explains why the user was sent back here from a recovery link;
// it disappears once a new link is requested.
export function RecoveryForm({ linkError }: { linkError?: RecoveryErrorKey }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<
    RecoveryFormState,
    FormData
  >(requestPasswordReset, {});
  const [email, setEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.errors?.email) emailRef.current?.focus();
  }, [state]);

  if (state.sent) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <h2 className="text-heading">{t("auth.forgot.sentTitle")}</h2>
        <p className="text-body break-words text-ink-secondary">
          {t("auth.forgot.sent", { email: state.email ?? "" })}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4.5">
      {linkError ? <FormAlert>{t(linkError)}</FormAlert> : null}
      <TextField
        ref={emailRef}
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        label={t("auth.fields.email")}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={state.errors?.email ? t(state.errors.email) : undefined}
      />
      <Button type="submit" pending={pending} className="mt-1.5 w-full">
        {pending ? t("auth.forgot.pending") : t("auth.forgot.submit")}
      </Button>
    </form>
  );
}
