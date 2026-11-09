import { cx } from "@/lib/cx";

const tones = {
  planning: "bg-planning-surface text-planning",
  active: "bg-active-surface text-active",
} as const;

// Business status label. `label` is the translated status name.
export function StatusBadge({
  status,
  label,
}: {
  status: keyof typeof tones;
  label: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-note font-medium",
        tones[status],
      )}
    >
      <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8">
        <circle cx="4" cy="4" r="4" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}
