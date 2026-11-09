import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, inject, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { assertLocalSupabaseUrl, localClient } from "../support/local-stack";

// Password recovery with the PKCE flow (TASK-012; architecture.md §3), against
// the local test stack and its email testing UI.
const url = inject("supabaseUrl");
const publishableKey = inject("supabasePublishableKey");
const mailpitUrl = inject("mailpitUrl");

// A PKCE client stands in for one browser: it keeps the code verifier in its
// own memory, like the browser's cookie.
function browser() {
  return createClient<Database>(assertLocalSupabaseUrl(url), publishableKey, {
    auth: { flowType: "pkce", persistSession: false, autoRefreshToken: false },
  });
}

async function recoveryLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const search = await fetch(
      `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    ).then((response) => response.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${mailpitUrl}/api/v1/message/${id}`).then(
        (response) => response.json(),
      );
      const href = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(message.HTML);
      if (href) return href[1].replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No recovery email for ${email}`);
}

// Supabase verifies the emailed link and redirects to the app with ?code=.
async function followLink(link: string): Promise<URL> {
  const response = await fetch(link, { redirect: "manual" });
  return new URL(response.headers.get("location") ?? "");
}

describe("password recovery (TASK-012)", () => {
  it("works only in the requesting browser and replaces the password", async () => {
    const email = `recovery-${randomUUID()}@example.com`;
    const signUp = await localClient(url, publishableKey).auth.signUp({
      email,
      password: "old-password-1",
    });
    expect(signUp.error).toBeNull();

    const requester = browser();
    const request = await requester.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/auth/confirm",
    });
    expect(request.error).toBeNull();

    const target = await followLink(await recoveryLink(email));
    expect(`${target.origin}${target.pathname}`).toBe(
      "http://localhost:3000/auth/confirm",
    );
    const code = target.searchParams.get("code");
    expect(code).toBeTruthy();

    // Another browser has no code verifier.
    const other = await browser().auth.exchangeCodeForSession(code!);
    expect(other.error).not.toBeNull();
    expect(other.data.session).toBeNull();

    // The requesting browser gets a session and sets the new password.
    const exchanged = await requester.auth.exchangeCodeForSession(code!);
    expect(exchanged.error).toBeNull();
    const updated = await requester.auth.updateUser({
      password: "new-password-2",
    });
    expect(updated.error).toBeNull();

    // The link cannot be used twice.
    const reused = await requester.auth.exchangeCodeForSession(code!);
    expect(reused.error).not.toBeNull();

    const oldLogin = await localClient(
      url,
      publishableKey,
    ).auth.signInWithPassword({ email, password: "old-password-1" });
    expect(oldLogin.error?.code).toBe("invalid_credentials");
    const newLogin = await localClient(
      url,
      publishableKey,
    ).auth.signInWithPassword({ email, password: "new-password-2" });
    expect(newLogin.error).toBeNull();
  });

  it("does not reveal whether an address is registered", async () => {
    const { error } = await browser().auth.resetPasswordForEmail(
      `nobody-${randomUUID()}@example.com`,
      { redirectTo: "http://localhost:3000/auth/confirm" },
    );
    expect(error).toBeNull();
  });
});
