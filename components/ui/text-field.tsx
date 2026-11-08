import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";
import {
  FieldLabel,
  FieldMessages,
  fieldControl,
  fieldDescription,
} from "./field";

type TextFieldProps = ComponentProps<"input"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  // Shown at the end of the label row (for example a "Forgot it?" link).
  labelAction?: ReactNode;
};

// Labelled input with an optional hint or error. Also used for the date of
// birth (type="date").
export function TextField({
  id,
  label,
  hint,
  error,
  labelAction,
  className,
  ...input
}: TextFieldProps) {
  const { errorId, hintId, describedBy } = fieldDescription(id, hint, error);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {labelAction}
      </div>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(fieldControl(Boolean(error)), className)}
        {...input}
      />
      <FieldMessages
        hintId={hintId}
        hint={hint}
        errorId={errorId}
        error={error}
      />
    </div>
  );
}
