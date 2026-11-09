import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

// Underlined inline link in the ink color (architecture.md §2, Visual Design).
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cx(
        "text-ink underline underline-offset-3 hover:text-ink-hover",
        "focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
      {...props}
    />
  );
}
