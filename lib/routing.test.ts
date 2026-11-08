import { describe, expect, it } from "vitest";
import {
  accessFor,
  destinationFor,
  recoveryErrorKey,
  recoveryErrorParam,
  redirectFor,
  rootDestination,
  type PageAccess,
  type UserState,
} from "./routing";

// specification.md SPEC-ROUTE-05, row by row. null = allowed.
const MATRIX: Array<
  [string, PageAccess | "root", Record<UserState, string | null>]
> = [
  [
    "/",
    "root",
    { anonymous: "/login", onboarding: "/onboarding", complete: "/dashboard" },
  ],
  [
    "/login",
    "guest",
    { anonymous: null, onboarding: "/onboarding", complete: "/dashboard" },
  ],
  [
    "/register",
    "guest",
    { anonymous: null, onboarding: "/onboarding", complete: "/dashboard" },
  ],
  [
    "/forgot-password",
    "guest",
    { anonymous: null, onboarding: "/onboarding", complete: "/dashboard" },
  ],
  [
    "/update-password",
    "account",
    { anonymous: "/login", onboarding: null, complete: null },
  ],
  [
    "/onboarding",
    "onboarding",
    { anonymous: "/login", onboarding: null, complete: "/dashboard" },
  ],
  [
    "/dashboard",
    "dashboard",
    { anonymous: "/login", onboarding: "/onboarding", complete: null },
  ],
];

describe("route access matrix (SPEC-ROUTE-05)", () => {
  for (const [route, access, expected] of MATRIX) {
    for (const state of ["anonymous", "onboarding", "complete"] as const) {
      it(`${route} as ${state} → ${expected[state] ?? "allowed"}`, () => {
        const actual =
          access === "root"
            ? rootDestination(state)
            : redirectFor(access, state);
        expect(actual).toBe(expected[state]);
      });
    }
  }
});

describe("destinationFor (proxy)", () => {
  it("applies the matrix by path, ignoring a trailing slash", () => {
    expect(destinationFor("/dashboard", "onboarding")).toBe("/onboarding");
    expect(destinationFor("/dashboard/", "anonymous")).toBe("/login");
    expect(destinationFor("/", "complete")).toBe("/dashboard");
    expect(destinationFor("/login", "anonymous")).toBeNull();
  });

  it("has no rule for other paths", () => {
    for (const path of [
      "/auth/confirm",
      "/dashboards",
      "/dashboard/x",
      "/favicon.ico",
      "/constructor",
    ]) {
      expect(accessFor(path), path).toBeNull();
      expect(destinationFor(path, "anonymous"), path).toBeNull();
    }
  });
});

describe("recovery link errors", () => {
  it("turns Supabase codes into fixed URL codes", () => {
    expect(recoveryErrorParam("otp_expired")).toBe("link_expired");
    expect(recoveryErrorParam("flow_state_not_found")).toBe("link_invalid");
    expect(recoveryErrorParam(null)).toBe("link_invalid");
  });

  it("maps URL codes to messages and anything else to the generic message", () => {
    expect(recoveryErrorKey(undefined)).toBeUndefined();
    expect(recoveryErrorKey("link_expired")).toBe("auth.forgot.linkExpired");
    expect(recoveryErrorKey("link_invalid")).toBe("auth.forgot.linkInvalid");
    expect(recoveryErrorKey("<script>alert(1)</script>")).toBe(
      "errors.generic",
    );
    expect(recoveryErrorKey("")).toBe("errors.generic");
  });
});
