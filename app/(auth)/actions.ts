"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authErrorKey, type AuthErrorKey } from "@/lib/auth-errors";
import { getCurrentUser } from "@/lib/supabase/auth";
import { homePathFor } from "@/lib/supabase/home-path";
import { createClient } from "@/lib/supabase/server";
import {
  validateEmail,
  validatePassword,
  type EmailError,
  type PasswordError,
} from "@/lib/validation";

// Result returned to the form. Messages are translation keys; the email is
// echoed back so the form can keep it after an error.
export type AuthFormState = {
  email?: string;
  errors?: { email?: EmailError; password?: PasswordError };
  formError?: AuthErrorKey;
};

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

// Registration (specification.md SPEC-AUTH-01, SPEC-AUTH-02, SPEC-AUTH-10).
// Email confirmation is disabled, so signUp returns a session and the
// on_auth_user_created trigger has already created the profile.
export async function signUp(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  const errors = {
    email: validateEmail(email),
    password: validatePassword(password, { requireMinLength: true }),
  };
  if (errors.email || errors.password) return { email, errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { email, formError: authErrorKey(error.code) };

  redirect("/onboarding");
}

// Login (specification.md SPEC-AUTH-03, SPEC-AUTH-04).
export async function signIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  const errors = {
    email: validateEmail(email),
    password: validatePassword(password, { requireMinLength: false }),
  };
  if (errors.email || errors.password) return { email, errors };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { email, formError: authErrorKey(error.code) };

  redirect(await homePathFor(supabase, data.user.id));
}

export type RecoveryFormState = {
  email?: string;
  errors?: { email?: EmailError };
  sent?: boolean;
};

// Password recovery request (specification.md SPEC-AUTH-07). With the PKCE
// flow, this stores a code verifier in a cookie of this browser, so the link
// works only here (architecture.md §3).
export async function requestPasswordReset(
  _previous: RecoveryFormState,
  formData: FormData,
): Promise<RecoveryFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const emailError = validateEmail(email);
  if (emailError) return { email, errors: { email: emailError } };

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  // The result is deliberately ignored: the page shows the same message
  // whether or not the address is registered. Supabase only accepts redirect
  // URLs from its allowlist (http://localhost:3000/**).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  });
  return { email, sent: true };
}

export type NewPasswordFormState = {
  errors?: { password?: PasswordError };
  formError?: AuthErrorKey;
};

// New password after recovery (specification.md SPEC-AUTH-09).
export async function updatePassword(
  _previous: NewPasswordFormState,
  formData: FormData,
): Promise<NewPasswordFormState> {
  const password = String(formData.get("password") ?? "");
  const passwordError = validatePassword(password, { requireMinLength: true });
  if (passwordError) return { errors: { password: passwordError } };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { formError: authErrorKey(error.code) };

  redirect(await homePathFor(supabase, user.id));
}

// Logout (specification.md SPEC-AUTH-06): revokes this session's refresh
// token and clears the session cookies. The language cookie is kept.
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
