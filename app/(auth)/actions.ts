"use server";

import { redirect } from "next/navigation";
import { authErrorKey, type AuthErrorKey } from "@/lib/auth-errors";
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
