import Image from "next/image";
import type { ReactNode } from "react";
import mapPhoto from "@/public/images/auth-map.jpg";

// Split screen for login, register and password recovery (architecture.md §2,
// Visual Design): form on the left over the light panel, photograph on the
// right with the language selector. On narrow screens the photograph is hidden
// and the language selector moves above the form.
export function AuthLayout({
  brand,
  languageSelector,
  children,
}: {
  brand: string;
  languageSelector: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[2fr_3fr]">
      <section className="flex flex-col bg-panel px-6 py-7 sm:px-14 sm:py-9">
        <header className="flex items-center justify-between gap-3">
          <span className="text-brand">{brand}</span>
          <div className="lg:hidden">{languageSelector}</div>
        </header>
        <main className="flex flex-1 flex-col justify-center py-12">
          <div className="flex w-full max-w-110 flex-col gap-8">{children}</div>
        </main>
      </section>
      <aside className="relative hidden bg-photo lg:block">
        <Image
          src={mapPhoto}
          alt=""
          fill
          sizes="60vw"
          placeholder="blur"
          loading="eager"
          className="object-cover"
        />
        <div className="absolute top-6 right-6">{languageSelector}</div>
      </aside>
    </div>
  );
}
