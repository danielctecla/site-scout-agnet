"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { Industry } from "@/lib/industries";
import { chatSystemPrompt } from "@/lib/location/agent";
import { askChat, askForProposal } from "@/lib/location/claude";
import { fetchEstablishments } from "@/lib/location/denue";
import { type Place, searchPlaces } from "@/lib/location/geocode";
import { evaluate } from "@/lib/location/evaluate";
import {
  type EvaluationForm,
  parseEvaluationInput,
} from "@/lib/location/input";
import { loadEvaluation } from "@/lib/location/load";
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

export async function findPlaces(
  text: string,
): Promise<{ places: Place[] } | ActionError> {
  const supabase = await createClient();
  if (!(await getCurrentUser(supabase))) redirect("/login");
  try {
    const locale = (await getLocale()) === "en" ? "en" : "es";
    return { places: await searchPlaces(String(text), locale) };
  } catch (error) {
    if (error instanceof LocationError) return { error: error.key };
    throw error;
  }
}

export type ChatMessage = { role: "user" | "assistant"; text: string };

// SPEC-LOC-10: the context is the stored evaluation, read through RLS, never
// data sent by the browser.
export async function askAgent(
  evaluationId: string,
  messages: ChatMessage[],
): Promise<{ answer: string } | { error: true }> {
  const supabase = await createClient();
  if (!(await getCurrentUser(supabase))) redirect("/login");
  const evaluation = await loadEvaluation(supabase, String(evaluationId));
  const history = (Array.isArray(messages) ? messages : [])
    .slice(-10)
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, text: String(m.text).slice(0, 1000) }));
  if (!evaluation || history.at(-1)?.role !== "user") return { error: true };

  const locale = (await getLocale()) === "en" ? "en" : "es";
  const transcript = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n\n");
  try {
    const answer = await askChat(
      chatSystemPrompt(evaluation.input, evaluation.result, locale),
      `${transcript}\n\nAnswer the last user message.`,
    );
    return { answer };
  } catch {
    return { error: true };
  }
}
