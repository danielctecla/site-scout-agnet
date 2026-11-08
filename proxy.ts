import { NextResponse, type NextRequest } from "next/server";
import { accessFor, destinationFor, type UserState } from "@/lib/routing";
import { homePathFor } from "@/lib/supabase/home-path";
import { updateSession } from "@/lib/supabase/proxy";

// Refreshes the session on every request and applies the route access matrix
// (specification.md SPEC-ROUTE-05) with real HTTP redirects before anything is
// rendered. With Cache Components, a redirect thrown by a page arrives after
// the prerendered shell and runs in the browser, so pages only keep their own
// check as a second layer (architecture.md §7).
export async function proxy(request: NextRequest) {
  const session = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Only page loads and client navigations: Server Action POSTs must reach
  // their action.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return session.response;
  }

  const state = await stateFor(session, pathname);
  const destination = state ? destinationFor(pathname, state) : null;
  if (!destination || destination === pathname) return session.response;

  const redirect = NextResponse.redirect(new URL(destination, request.url));
  for (const cookie of session.response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

// The user's state, read only for paths that have an access rule.
async function stateFor(
  session: Awaited<ReturnType<typeof updateSession>>,
  pathname: string,
): Promise<UserState | null> {
  if (accessFor(pathname) === null) return null;
  if (!session.userId) return "anonymous";
  const home = await homePathFor(session.supabase, session.userId);
  return home === "/dashboard" ? "complete" : "onboarding";
}

export const config = {
  // Every route except static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
