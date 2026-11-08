// Step indicator for onboarding: visible text ("Paso 1 de 2") over one bar
// per step. `label` is the translated text, also used as the value text.
export function ProgressSteps({
  current,
  total,
  label,
  name,
}: {
  current: number;
  total: number;
  label: string;
  // Accessible name of the progress bar, for example "Progreso del onboarding".
  name: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <span className="text-note font-medium text-ink-tertiary">{label}</span>
      <div
        role="progressbar"
        aria-label={name}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={label}
        className="flex w-40 gap-1.5"
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={
              index < current
                ? "h-1 flex-1 rounded-full bg-ink"
                : "h-1 flex-1 rounded-full bg-divider"
            }
          />
        ))}
      </div>
    </div>
  );
}
