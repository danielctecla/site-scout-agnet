import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { PageIntro } from "@/components/ui/page-intro";
import { TextLink } from "@/components/ui/text-link";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("register") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  return (
    <>
      <PageIntro title={t("title")} description={t("subtitle")} />
      <CredentialsForm mode="register" />
      <hr className="border-divider" />
      <p className="text-label text-ink-secondary">
        {t("haveAccount")} <TextLink href="/login">{t("login")}</TextLink>
      </p>
    </>
  );
}
