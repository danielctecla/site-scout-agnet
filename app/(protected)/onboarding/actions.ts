"use server";

import { redirect } from "next/navigation";
import { dbErrorKey, type DbErrorKey } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

// The database functions validate everything and act only on the signed-in
// user (database.md §7.3, §7.4); these actions only call them.

export async function savePersonalInformation(input: {
  fullName: string;
  birthDate: string;
}): Promise<{ error?: DbErrorKey }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_personal_information", {
    p_full_name: input.fullName,
    p_birth_date: input.birthDate,
  });
  return error ? { error: dbErrorKey(error) } : {};
}

export async function finishOnboarding(input: {
  businessName: string;
  industry: string;
  hasEstablishment: boolean;
}): Promise<{ error?: DbErrorKey }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_onboarding", {
    p_business_name: input.businessName,
    p_industry: input.industry,
    p_status: input.hasEstablishment ? "active" : "planning",
  });
  const key = error ? dbErrorKey(error) : undefined;
  // A repeated call (double click, retry) means onboarding is already done.
  if (key && key !== "errors.onboarding_already_completed") {
    return { error: key };
  }
  redirect("/dashboard");
}
