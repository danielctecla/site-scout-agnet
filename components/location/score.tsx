// Score out of 100 with a thin bar (Visual Design: ink only, no accent).
export function Score({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex w-33 flex-none flex-col items-end gap-2">
      <span className="text-note text-ink-tertiary">{label}</span>
      <span className="text-display leading-none">
        {value}
        <span className="text-body tracking-normal text-ink-tertiary">
          {" "}
          /100
        </span>
      </span>
      <span aria-hidden="true" className="h-1 w-full rounded-full bg-divider">
        <span
          className="block h-1 rounded-full bg-ink"
          style={{ width: `${value}%` }}
        />
      </span>
    </div>
  );
}
