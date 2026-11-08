import { NextResponse, type NextRequest } from "next/server";
import { recoveryErrorParam } from "@/lib/routing";
import { createClient } from "@/lib/supabase/server";

// Recovery link target (architecture.md §3). Supabase verifies the emailed
// link and redirects here with ?code=; exchanging it needs the code verifier
// stored in this browser by the recovery request. Redirects go only to fixed
// internal paths, and errors carry fixed codes, never text from the URL.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const to = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));
  const fail = (code: string | null) =>
    to(`/forgot-password?error=${recoveryErrorParam(code)}`);

  const code = searchParams.get("code");
  if (!code) return fail(searchParams.get("error_code"));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(error.code ?? null);

  return to("/update-password");
}
