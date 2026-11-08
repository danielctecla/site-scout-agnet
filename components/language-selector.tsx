"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocalePreference } from "@/i18n/actions";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { cx } from "@/lib/cx";

// Language dropdown (architecture.md §2 and §9). "floating" sits on the
// photograph of the authentication pages; "outlined" on light backgrounds.
// Refreshing re-renders server components in the new language while client
// state (such as the onboarding step and entered values) is kept.
export function LanguageSelector({
  variant = "outlined",
}: {
  variant?: "outlined" | "floating";
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="relative inline-flex items-center text-ink">
      <span className="sr-only">{t("language")}</span>
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        className="pointer-events-none absolute left-3.5"
      >
        <circle cx="9" cy="9" r="7.25" />
        <path d="M1.75 9h14.5" />
        <path d="M9 1.75c2 2 3 4.4 3 7.25s-1 5.25-3 7.25c-2-2-3-4.4-3-7.25s1-5.25 3-7.25Z" />
      </svg>
      <select
        value={locale}
        disabled={pending}
        aria-busy={pending || undefined}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(async () => {
            await setLocalePreference(next);
            router.refresh();
          });
        }}
        className={cx(
          "h-11 cursor-pointer appearance-none rounded-xl bg-white pr-9 pl-10 text-label text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          variant === "floating"
            ? "shadow-[0_2px_10px_rgb(0_0_0/0.08)]"
            : "border border-divider",
        )}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {t(`languages.${code}`)}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3.5"
      >
        <path d="m3.5 5.5 3.5 3.5 3.5-3.5" />
      </svg>
    </label>
  );
}
