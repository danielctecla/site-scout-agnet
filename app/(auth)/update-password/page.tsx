import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { PageIntro } from "@/components/ui/page-intro";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("updatePassword") };
}

// Any signed-in user, whatever the onboarding state: a recovery link signs
// the user in before they set the new password (SPEC-ROUTE-05).
export default async function UpdatePasswordPage() {
  await guardPage("account");
  const t = await getTranslations("auth.update");
  return (
    <>
      <PageIntro title={t("title")} description={t("subtitle")} />
      <NewPasswordForm />
    </>
  );
}
