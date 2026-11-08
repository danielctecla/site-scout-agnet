import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import {
  FieldLabel,
  FieldMessages,
  fieldControl,
  fieldControlInvalid,
  fieldDescription,
} from "./field";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

// Labelled input with an optional hint or error. Also used for the date of
// birth (type="date").
export function TextField({
  id,
  label,
  hint,
  error,
  className,
  ...input
}: TextFieldProps) {
  const { errorId, hintId, describedBy } = fieldDescription(id, hint, error);
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(fieldControl, error && fieldControlInvalid, className)}
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
