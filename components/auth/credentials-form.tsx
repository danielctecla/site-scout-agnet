"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import { TextLink } from "@/components/ui/text-link";

// Email and password form for login and registration. Validation runs in the
// Server Action; errors come back as translation keys.
export function CredentialsForm({ mode }: { mode: "login" | "register" }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? signIn : signUp,
    {},
  );
  // Controlled so it survives the form reset after each submission.
  const [email, setEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Move focus to the first field with an error.
  useEffect(() => {
    if (state.errors?.email) emailRef.current?.focus();
    else if (state.errors?.password) passwordRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4.5">
      {state.formError ? <FormAlert>{t(state.formError)}</FormAlert> : null}
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
      <TextField
        ref={passwordRef}
        id="password"
        name="password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        label={t("auth.fields.password")}
        hint={mode === "register" ? t("auth.register.passwordHint") : undefined}
        error={state.errors?.password ? t(state.errors.password) : undefined}
        labelAction={
          mode === "login" ? (
            <TextLink href="/forgot-password" className="text-label">
              {t("auth.login.forgotPassword")}
            </TextLink>
          ) : undefined
        }
      />
      <Button type="submit" pending={pending} className="mt-1.5 w-full">
        {pending ? t(`auth.${mode}.pending`) : t(`auth.${mode}.submit`)}
      </Button>
    </form>
  );
}
