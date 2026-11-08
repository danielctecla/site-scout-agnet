import type { ReactNode } from "react";
import { LanguageSelector } from "@/components/language-selector";

// Centered single column on a white page (architecture.md §2, Visual Design).
export function OnboardingLayout({
  brand,
  children,
}: {
  brand: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex items-center justify-between gap-3 px-6 py-7 sm:px-14">
        <span className="text-brand">{brand}</span>
        <LanguageSelector variant="outlined" />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pt-4 pb-16">
        <div className="flex w-full max-w-110 flex-col gap-9">{children}</div>
      </main>
    </div>
  );
}
