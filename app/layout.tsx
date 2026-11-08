import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

// Placeholder shell. TASK-019 adds translations and sets <html lang> from the
// resolved locale.
export const metadata: Metadata = {
  title: "Business Management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
