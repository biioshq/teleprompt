import Link from "next/link";
import { forwardRef } from "react";

import { cn } from "~/lib/utils";

type Variant = "primary" | "brand" | "outline" | "ghost" | "danger" | "stage";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex select-none items-center justify-center gap-2 rounded-sm border font-medium " +
  "transition-[transform,box-shadow,background-color,color] duration-150 ease-out " +
  "disabled:pointer-events-none disabled:opacity-45";

const VARIANTS: Record<Variant, string> = {
  // Ink on paper with a hard offset shadow that collapses on press: the
  // Biios signature, and the only "depth" in the system.
  primary:
    "border-ink bg-ink text-paper shadow-hard hover:-translate-x-px hover:-translate-y-px " +
    "hover:shadow-hard-lg active:translate-x-px active:translate-y-px active:shadow-none",
  brand:
    "border-ink bg-brand text-ink shadow-hard hover:-translate-x-px hover:-translate-y-px " +
    "hover:shadow-hard-lg active:translate-x-px active:translate-y-px active:shadow-none",
  outline:
    "border-ink bg-transparent text-ink hover:bg-ink hover:text-paper active:translate-y-px",
  ghost:
    "border-transparent bg-transparent text-muted hover:bg-paper-deep hover:text-ink",
  danger:
    "border-coral bg-coral-soft text-coral hover:bg-coral hover:text-paper active:translate-y-px",
  stage:
    "border-stage-line bg-stage-raised text-stage-ink hover:border-brand hover:text-brand active:translate-y-px",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[0.9375rem]",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant, size, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={buttonClasses({ variant, size, className })}
        {...props}
      />
    );
  },
);

export type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props} />
  );
}
