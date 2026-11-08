import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

// Refreshes the Supabase session on every request and writes the updated
// cookies to both the request (for this render) and the response (for the
// browser). Server Components cannot write cookies, so this is where refreshed
// tokens are persisted (architecture.md §2, §7).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache-Control headers that keep auth responses out of any cache.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Validates the session and refreshes it if needed. It must run before the
  // response is returned, or a refreshed token would be lost.
  await supabase.auth.getClaims();

  return response;
}
