import type { ReactNode } from "react";
import { signOut } from "@/app/(auth)/actions";
import { LanguageSelector } from "@/components/language-selector";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

// Light grey page with the brand, language selector and logout in the header
// and a 720 px column (architecture.md §2, Visual Design). `wide`: a 1240 px
// column for Location Evaluation results.
export function DashboardLayout({
  brand,
  signOutLabel,
  wide = false,
  children,
}: {
  brand: string;
  signOutLabel: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-7 sm:px-14">
        <span className="text-brand">{brand}</span>
        <div className="flex items-center gap-3">
          <LanguageSelector variant="outlined" />
          <form action={signOut}>
            <Button type="submit" variant="secondary" size="sm">
              {signOutLabel}
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 justify-center px-6 pt-12 pb-16">
        <div
          className={cx(
            "flex w-full flex-col gap-8",
            wide ? "max-w-310" : "max-w-180",
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
