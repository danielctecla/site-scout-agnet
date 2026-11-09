import { randomUUID } from "node:crypto";
import { describe, expect, inject, it } from "vitest";
import { getCurrentUser } from "@/lib/supabase/auth";
import { localClient } from "../support/local-stack";

// Runs against the local test stack only (see global-setup.ts).
const url = inject("supabaseUrl");
const publishableKey = inject("supabasePublishableKey");

async function signUp() {
  const client = localClient(url, publishableKey);
  const { data, error } = await client.auth.signUp({
    email: `it-${randomUUID()}@example.com`,
    password: "long-enough-1",
  });
  expect(error).toBeNull();
  expect(data.session).not.toBeNull();
  return { client, userId: data.user!.id };
}

describe("signup through the Auth service (TASK-006)", () => {
  it("creates an empty profile for the new user", async () => {
    const { client, userId } = await signUp();
    const { data, error } = await client.from("profiles").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([
      expect.objectContaining({
        id: userId,
        full_name: null,
        birth_date: null,
        onboarding_completed_at: null,
      }),
    ]);
  });
});

describe("getCurrentUser (TASK-004)", () => {
  it("returns the signed-in user", async () => {
    const { client, userId } = await signUp();
    await expect(getCurrentUser(client)).resolves.toEqual(
      expect.objectContaining({ id: userId }),
    );
  });

  it("returns null without a session", async () => {
    await expect(
      getCurrentUser(localClient(url, publishableKey)),
    ).resolves.toBeNull();
  });
});

describe("finish_onboarding concurrency (TASK-009)", () => {
  it("creates exactly one business when called twice in parallel", async () => {
    const { client } = await signUp();
    const saved = await client.rpc("save_personal_information", {
      p_full_name: "Parallel",
      p_birth_date: "1990-05-14",
    });
    expect(saved.error).toBeNull();

    const call = () =>
      client.rpc("finish_onboarding", {
        p_business_name: "Parallel Shop",
        p_industry: "retail",
        p_status: "active",
      });
    const results = await Promise.all([call(), call()]);

    const succeeded = results.filter((r) => r.error === null);
    const failed = results.filter((r) => r.error !== null);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toMatchObject({
      code: "P0001",
      message: "onboarding_already_completed",
    });

    const { data: businesses } = await client.from("businesses").select("id");
    expect(businesses).toEqual([{ id: succeeded[0].data }]);
  });
});
