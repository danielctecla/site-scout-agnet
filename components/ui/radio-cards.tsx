import type { ChangeEventHandler } from "react";
import { cx } from "@/lib/cx";

type Option = { value: string; label: string; description?: string };

type RadioCardsProps = {
  name: string;
  legend: string;
  options: Option[];
  // Empty string or undefined: nothing selected (no preselected answer).
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  error?: string;
  required?: boolean;
};

// A group of large radio choices (used for the physical establishment question).
export function RadioCards({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  required,
}: RadioCardsProps) {
  const errorId = error ? `${name}-error` : undefined;
  return (
    <fieldset aria-describedby={errorId} className="flex flex-col gap-2">
      <legend className="mb-2 text-label font-medium">{legend}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              "flex cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-4",
              "has-checked:border-ink has-checked:shadow-[inset_0_0_0_1px_var(--color-ink)]",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-ink",
              error ? "border-error" : "border-border",
            )}
          >
            <span className="flex items-center gap-2.5 text-body font-medium">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={
                  value === undefined ? undefined : value === option.value
                }
                onChange={onChange}
                required={required}
                className="size-[18px] accent-ink"
              />
              {option.label}
            </span>
            {option.description ? (
              <span className="text-note text-ink-tertiary">
                {option.description}
              </span>
            ) : null}
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-note text-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
