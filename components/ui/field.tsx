import type { ReactNode } from "react";

// Shared pieces of the form field primitives.

const fieldBase =
  "h-[54px] w-full rounded-lg border bg-white px-4 text-body text-ink " +
  "placeholder:text-ink-tertiary focus:outline-none focus:ring-3 " +
  "disabled:bg-panel disabled:text-ink-tertiary";

// Exactly one color set is applied, so the error colors never compete with
// the normal focus colors in the generated CSS.
export function fieldControl(invalid: boolean) {
  return invalid
    ? `${fieldBase} border-error focus:border-error focus:ring-error/12`
    : `${fieldBase} border-border focus:border-ink focus:ring-ink/12`;
}

// Ids of the hint and error paragraphs, and the aria-describedby value that
// points to whichever is shown (the error replaces the hint).
export function fieldDescription(id: string, hint?: string, error?: string) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = !error && hint ? `${id}-hint` : undefined;
  return { errorId, hintId, describedBy: errorId ?? hintId };
}

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-label font-medium">
      {children}
    </label>
  );
}

export function FieldMessages({
  hintId,
  hint,
  errorId,
  error,
}: {
  hintId?: string;
  hint?: string;
  errorId?: string;
  error?: string;
}) {
  if (error) {
    return (
      <p
        id={errorId}
        className="flex items-center gap-1.5 text-note text-error"
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="flex-none"
        >
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 4.5v4" />
          <path d="M8 11h.01" />
        </svg>
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={hintId} className="text-note text-ink-tertiary">
        {hint}
      </p>
    );
  }
  return null;
}
