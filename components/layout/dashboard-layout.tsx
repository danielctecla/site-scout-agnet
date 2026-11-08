import type { ReactNode } from "react";
import { signOut } from "@/app/(auth)/actions";
import { LanguageSelector } from "@/components/language-selector";
import { Button } from "@/components/ui/button";

// Light grey page with the brand, language selector and logout in the header
// and a 720 px column (architecture.md §2, Visual Design).
export function DashboardLayout({
  brand,
  signOutLabel,
  children,
}: {
  brand: string;
  signOutLabel: string;
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
        <div className="flex w-full max-w-180 flex-col gap-8">{children}</div>
      </main>
    </div>
  );
}
