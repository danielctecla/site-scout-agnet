// Route access rules (specification.md SPEC-ROUTE-05) as pure functions, so
// the whole matrix is unit tested. Pages and the proxy apply them.

export type UserState = "anonymous" | "onboarding" | "complete";

// guest: login, register, forgot password (signed-in users go home)
// account: update password (any signed-in user)
// onboarding / dashboard: the two main pages
export type PageAccess = "guest" | "account" | "onboarding" | "dashboard";

export type Destination = "/login" | "/onboarding" | "/dashboard";

export function homeFor(state: Exclude<UserState, "anonymous">): Destination {
  return state === "complete" ? "/dashboard" : "/onboarding";
}

// Where to send the user instead, or null when the page is allowed.
export function redirectFor(
  access: PageAccess,
  state: UserState,
): Destination | null {
  if (state === "anonymous") return access === "guest" ? null : "/login";
  if (access === "guest") return homeFor(state);
  if (access === "account") return null;
  const home = homeFor(state);
  return home === `/${access}` ? null : home;
}

// "/" always redirects.
export function rootDestination(state: UserState): Destination {
  return state === "anonymous" ? "/login" : homeFor(state);
}

// The pages covered by the matrix, by path. Other paths (/auth/confirm,
// assets) have no access rule.
const PAGE_ACCESS: Record<string, PageAccess | "root"> = {
  "/": "root",
  "/login": "guest",
  "/register": "guest",
  "/forgot-password": "guest",
  "/update-password": "account",
  "/onboarding": "onboarding",
  "/dashboard": "dashboard",
};

export function accessFor(pathname: string): PageAccess | "root" | null {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return Object.hasOwn(PAGE_ACCESS, path) ? PAGE_ACCESS[path] : null;
}

// The redirect for a path, or null when the request may proceed.
export function destinationFor(
  pathname: string,
  state: UserState,
): Destination | null {
  const access = accessFor(pathname);
  if (access === null) return null;
  return access === "root"
    ? rootDestination(state)
    : redirectFor(access, state);
}

// Recovery link errors: /auth/confirm sends a fixed code in ?error=, and
// /forgot-password maps it to a message. Anything else shows the generic
// message; text from the URL is never displayed.
export type RecoveryErrorParam = "link_expired" | "link_invalid";

export function recoveryErrorParam(
  supabaseCode: string | null | undefined,
): RecoveryErrorParam {
  return supabaseCode === "otp_expired" ? "link_expired" : "link_invalid";
}

export type RecoveryErrorKey =
  "auth.forgot.linkExpired" | "auth.forgot.linkInvalid" | "errors.generic";

export function recoveryErrorKey(
  param: string | undefined,
): RecoveryErrorKey | undefined {
  if (param === undefined) return undefined;
  if (param === "link_expired") return "auth.forgot.linkExpired";
  if (param === "link_invalid") return "auth.forgot.linkInvalid";
  return "errors.generic";
}
