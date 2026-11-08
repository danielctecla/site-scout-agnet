import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Session refresh only. Route protection is added in TASK-013.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Every route except static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
