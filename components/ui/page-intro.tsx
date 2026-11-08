import { cx } from "@/lib/cx";

// Page title and introduction. Onboarding centers it and uses the smaller
// display size (architecture.md §2, Visual Design).
export function PageIntro({
  title,
  description,
  centered = false,
}: {
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div className={cx("flex flex-col gap-3.5", centered && "text-center")}>
      <h1 className={centered ? "text-display-sm" : "text-display"}>{title}</h1>
      {description ? (
        <p className="text-lead text-ink-secondary">{description}</p>
      ) : null}
    </div>
  );
}
