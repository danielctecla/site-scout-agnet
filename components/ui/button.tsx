import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-white hover:bg-ink-hover disabled:bg-divider disabled:text-ink-tertiary",
  secondary:
    "border border-border bg-white text-ink hover:bg-panel disabled:text-ink-tertiary",
};

const sizes = {
  // Form actions.
  md: "h-[54px] px-6 text-body",
  // Header actions such as "Cerrar sesión".
  sm: "h-11 px-4 text-label",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  // While pending the button is disabled and shows a spinner; pass the
  // in-progress label (for example "Guardando…") as children.
  pending?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  pending = false,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2.5 rounded-lg font-medium transition-colors",
        sizes[size],
        "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink",
        "disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-spin motion-reduce:animate-none"
    >
      <path d="M9 2a7 7 0 1 0 7 7" />
    </svg>
  );
}
