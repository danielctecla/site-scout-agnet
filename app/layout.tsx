import type { Metadata } from "next";
import "./globals.css";

// Placeholder shell. TASK-019 adds translations and sets <html lang> from the
// resolved locale; the visual design is defined before the first UI task.
export const metadata: Metadata = {
  title: "Business Management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
