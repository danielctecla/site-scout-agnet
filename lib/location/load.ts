import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { EvaluationInput, EvaluationResult } from "./types";

export type StoredEvaluation = {
  id: string;
  input: EvaluationInput;
  result: EvaluationResult;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RLS returns only the signed-in user's rows, so another user's id reads as
// not found (SPEC-LOC-11).
export async function loadEvaluation(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<StoredEvaluation | null> {
  if (!UUID.test(id)) return null;
  const { data } = await supabase
    .from("location_evaluations")
    .select("id, input, result")
    .eq("id", id)
    .maybeSingle();
  return data
    ? {
        id: data.id,
        input: data.input as unknown as EvaluationInput,
        result: data.result as unknown as EvaluationResult,
      }
    : null;
}
