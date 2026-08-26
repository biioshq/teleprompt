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

/**
 * The attribution line that sits under the logotype in the headers: `biios`
 * keeps its orange so the studio name reads as the studio name and not as a
 * second half of the product name.
 */
export function Byline({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[0.625rem] leading-none font-medium tracking-[0.01em] text-faint lowercase",
        className,
      )}
    >
      by <span className="font-bold tracking-[-0.03em] text-brand">biios</span>
    </span>
  );
}

export function Logo({
  className,
  markClassName,
  wordmarkClassName,
  bylineClassName,
  byline = false,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  bylineClassName?: string;
  byline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark className={cn("h-7 w-7", markClassName)} />
      <span
        className={cn(
          /* The stack holds the lockup's line-height, not the two lines
             themselves. `cn` merges a caller's `wordmarkClassName` over the
             wordmark's own classes, and tailwind-merge counts a font size as
             replacing a leading — Tailwind sizes carry one — so a caller who
             only meant to ask for a bigger wordmark takes its `leading-none`
             away with them. That is how the two headers ended up drawing two
             different lockups from the same component. Set here it is
             inherited, and nothing a caller passes can reach it. */
          "inline-flex flex-col items-start leading-none",
          /* Both lines are `leading-none`, so their boxes end well short of
             the ink: the stack's letters sit low inside it and read as
             misaligned against the mark. The padding lifts the ink back onto
             the mark's centre line. */
          byline && "pb-[3px]",
        )}
      >
        {/* The gap that keeps the wordmark's descenders off `by biios`. It has
            to be here rather than on the byline, and in `em` rather than in
            pixels, because the thing it is clearing — how far the `p` of
            `teleprompt` drops below its own line box — scales with the
            wordmark, which the caller sizes, and not with the byline, which is
            a fixed size.

            It is set wide enough for the deepest descender in the display
            stack rather than for Familjen Grotesk's, which is one of the
            shallowest. A device with no Arial to lend the fallback face its
            metrics falls all the way through to Jakarta, whose `p` hangs
            nearly a pixel lower, and that is the case this has to survive. */}
        <Wordmark className={cn(byline && "mb-[0.12em]", wordmarkClassName)} />
        {byline ? <Byline className={bylineClassName} /> : null}
      </span>
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
