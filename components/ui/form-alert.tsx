import type { ReactNode } from "react";

// Form-level error (for example, invalid credentials or a failed save).
// role="alert" makes screen readers announce it when it appears.
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg bg-error-surface px-4 py-3.5 text-label text-error-ink"
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="mt-px flex-none"
      >
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4.5v4" />
        <path d="M8 11h.01" />
      </svg>
      <div>{children}</div>
    </div>
  );
}
