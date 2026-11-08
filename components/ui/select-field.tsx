import type { SelectHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import {
  FieldLabel,
  FieldMessages,
  fieldControl,
  fieldDescription,
} from "./field";

type Option = { value: string; label: string };

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  options: Option[];
  // Shown first with an empty value, so nothing is preselected.
  placeholder: string;
  hint?: string;
  error?: string;
};

// Native dropdown styled like the text fields (used for the industry).
export function SelectField({
  id,
  label,
  options,
  placeholder,
  hint,
  error,
  className,
  ...select
}: SelectFieldProps) {
  const { errorId, hintId, describedBy } = fieldDescription(id, hint, error);
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            fieldControl(Boolean(error)),
            "appearance-none pr-11 invalid:text-ink-tertiary",
            className,
          )}
          {...select}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute top-[19px] right-4"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </div>
      <FieldMessages
        hintId={hintId}
        hint={hint}
        errorId={errorId}
        error={error}
      />
    </div>
  );
}
