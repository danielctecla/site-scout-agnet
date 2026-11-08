"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { Industry } from "@/lib/industries";
import { askForProposal } from "@/lib/location/claude";
import { fetchEstablishments } from "@/lib/location/denue";
import { evaluate } from "@/lib/location/evaluate";
import {
  type EvaluationForm,
  parseEvaluationInput,
} from "@/lib/location/input";
import { LocationError, type LocationErrorKey } from "@/lib/location/types";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type ActionError = {
  error: LocationErrorKey;
  details?: Record<string, number>;
};

// Runs the pipeline and stores the evaluation with the user's own session
// (RLS). On success it redirects to the results; on failure the form keeps
// its values and offers Retry (SPEC-LOC-12).
export async function runEvaluation(
  form: EvaluationForm,
): Promise<ActionError> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");
  const { data: business } = await supabase
    .from("businesses")
    .select("industry")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const input = parseEvaluationInput(form, business.industry as Industry);
  if (!input) throw new Error("Invalid evaluation input");

  let id: string;
  try {
    const locale = (await getLocale()) === "en" ? "en" : "es";
    const result = await evaluate(
      input,
      { fetchEstablishments, ask: askForProposal },
      locale,
    );
    const { data, error } = await supabase
      .from("location_evaluations")
      .insert({
        input: input as unknown as NonNullable<Json>,
        result: result as unknown as NonNullable<Json>,
      })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
  } catch (error) {
    if (error instanceof LocationError) {
      return { error: error.key, details: error.details };
    }
    console.error("Evaluation failed:", error);
    return { error: "analysis_failed" };
  }
  redirect(`/evaluations/${id}`);
}
