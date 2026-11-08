import { randomUUID } from "node:crypto";
import { describe, expect, inject, it } from "vitest";
import { authErrorKey } from "@/lib/auth-errors";
import { localClient } from "../support/local-stack";

// The Supabase Auth error codes the app translates (TASK-011) are the ones the
// Auth service actually returns. Runs against the local test stack only.
const url = inject("supabaseUrl");
const publishableKey = inject("supabasePublishableKey");
const client = () => localClient(url, publishableKey);
const email = () => `auth-${randomUUID()}@example.com`;

describe("Supabase Auth error codes (TASK-011)", () => {
  it("rejects a duplicate registration with a translated code", async () => {
    const address = email();
    const first = await client().auth.signUp({
      email: address,
      password: "long-enough-1",
    });
    expect(first.error).toBeNull();

    const second = await client().auth.signUp({
      email: address,
      password: "long-enough-2",
    });
    expect(authErrorKey(second.error?.code)).toBe(
      "errors.auth.user_already_exists",
    );
  });

  it("rejects a password shorter than 8 characters", async () => {
    const { error } = await client().auth.signUp({
      email: email(),
      password: "1234567",
    });
    expect(authErrorKey(error?.code)).toBe("errors.auth.weak_password");
  });

  it("rejects wrong credentials", async () => {
    const address = email();
    await client().auth.signUp({ email: address, password: "long-enough-1" });
    const { error } = await client().auth.signInWithPassword({
      email: address,
      password: "wrong-password",
    });
    expect(authErrorKey(error?.code)).toBe("errors.auth.invalid_credentials");
  });

  it("does not require email confirmation", async () => {
    const { data, error } = await client().auth.signUp({
      email: email(),
      password: "long-enough-1",
    });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
  });
});
