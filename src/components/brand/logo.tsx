import { cn } from "~/lib/utils";

/**
 * The mark: three lines of a script, with the one on the reading line lit in
 * Biios orange and running off the edge of the frame — the line being read is
 * also the line being sent to the other device.
 */
export function Mark({
  className,
  title = "Teleprompt",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={cn("h-8 w-8", className)}
    >
      <rect width="32" height="32" rx="7" fill="var(--color-ink)" />
      <rect
        x="6"
        y="8.6"
        width="12"
        height="3.2"
        rx="1.6"
        fill="var(--color-paper)"
        opacity="0.4"
      />
      <rect
        x="6"
        y="14.2"
        width="24"
        height="4"
        rx="2"
        fill="var(--color-brand)"
      />
      <rect
        x="6"
        y="20.6"
        width="8"
        height="3.2"
        rx="1.6"
        fill="var(--color-paper)"
        opacity="0.4"
      />
    </svg>
  );
}

/** Lowercase wordmark, echoing the `biios` wordmark it sits beside. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[1.0625rem] leading-none font-semibold tracking-[-0.035em] lowercase",
        className,
      )}
    >
      teleprompt
    </span>
  );
}

export function Logo({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark className={cn("h-7 w-7", markClassName)} />
      <Wordmark className={wordmarkClassName} />
    </span>
  );
}

/** The `biios` wordmark, used where we point back at the studio. */
export function BiiosWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-base leading-none font-bold tracking-[-0.04em] lowercase",
        className,
      )}
    >
      biios
    </span>
  );
}
