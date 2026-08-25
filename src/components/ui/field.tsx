import { forwardRef } from "react";

import { cn } from "~/lib/utils";

const CONTROL =
  "border-line bg-surface text-ink placeholder:text-faint w-full rounded-sm border px-3 py-2 text-sm " +
  "transition-colors outline-none focus:border-ink";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(CONTROL, className)} {...props} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(CONTROL, "resize-y font-mono leading-relaxed", className)}
      {...props}
    />
  );
});

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block font-mono text-[0.6875rem] tracking-[0.12em] text-muted uppercase",
        className,
      )}
      {...props}
    />
  );
}
