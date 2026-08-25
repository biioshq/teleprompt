import { cn } from "~/lib/utils";

type Tone = "neutral" | "brand" | "jade" | "coral" | "blue" | "stage";

/**
 * Status tags are squared and carry a lit bar down the left edge, echoing the
 * active line in the mark. Nothing on this site is pill-shaped: the radius
 * scale is sharp throughout, and a stray `rounded-full` chip reads as borrowed
 * from a different design system.
 *
 * Reserved for real state. Anything decorative belongs in the copy, or in a
 * `Cue`.
 */
const TONES: Record<Tone, string> = {
  neutral: "border-l-line-firm bg-paper-deep text-muted",
  brand: "border-l-brand bg-brand-soft text-brand-deep",
  jade: "border-l-jade bg-jade-soft text-jade",
  coral: "border-l-coral bg-coral-soft text-coral",
  blue: "border-l-blue bg-blue-soft text-blue",
  stage: "border-l-stage-muted bg-stage-raised text-stage-muted",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs border-l-2 px-2 py-1 font-mono text-[0.625rem] tracking-[0.09em] uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A dot that breathes while something is genuinely live. Never decorative. */
export function LiveDot({
  active = true,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        active ? "animate-live bg-brand" : "bg-faint",
        className,
      )}
    />
  );
}
