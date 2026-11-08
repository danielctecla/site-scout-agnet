// Browser-safe Supabase settings from .env.local (architecture.md §11).
// NEXT_PUBLIC_ variables must be read with static property access so that
// Next.js can inline them into the browser bundle.
export function supabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill in both values.",
    );
  }
  return { url, publishableKey };
}
