import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RecoveryForm } from "@/components/auth/recovery-form";
import { PageIntro } from "@/components/ui/page-intro";
import { TextLink } from "@/components/ui/text-link";
import { recoveryErrorKey } from "@/lib/routing";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("forgotPassword") };
}

export default async function ForgotPasswordPage({
  searchParams,
}: PageProps<"/forgot-password">) {
  await guardPage("guest");
  const t = await getTranslations();
  const { error } = await searchParams;
  // Only fixed codes are mapped; the URL's text is never displayed.
  const errorKey = recoveryErrorKey(
    typeof error === "string" ? error : undefined,
  );

  return (
    <>
      <PageIntro
        title={t("auth.forgot.title")}
        description={t("auth.forgot.subtitle")}
      />
      <RecoveryForm linkError={errorKey} />
      <hr className="border-divider" />
      <p className="text-label">
        <TextLink href="/login">{t("auth.forgot.backToLogin")}</TextLink>
      </p>
    </>
  );
}
