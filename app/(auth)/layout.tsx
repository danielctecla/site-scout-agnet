import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AuthLayout } from "@/components/layout/auth-layout";

export default async function AuthPagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("common");
  return <AuthLayout brand={t("appName")}>{children}</AuthLayout>;
}
