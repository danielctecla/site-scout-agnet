import { redirectFromRoot } from "@/lib/supabase/guards";

// "/" sends each user where they belong (specification.md SPEC-ROUTE-05).
export default async function Home() {
  await redirectFromRoot();
}
