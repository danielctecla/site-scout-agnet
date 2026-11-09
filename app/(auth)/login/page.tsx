import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { PageIntro } from "@/components/ui/page-intro";
import { TextLink } from "@/components/ui/text-link";
import { guardPage } from "@/lib/supabase/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("login") };
}

export default async function LoginPage() {
  await guardPage("guest");
  const t = await getTranslations("auth.login");
  return (
    <>
      <PageIntro title={t("title")} description={t("subtitle")} />
      <CredentialsForm mode="login" />
      <hr className="border-divider" />
      <p className="text-label text-ink-secondary">
        {t("noAccount")} <TextLink href="/register">{t("register")}</TextLink>
      </p>
    </>
  );
}
