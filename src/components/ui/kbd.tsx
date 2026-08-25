import { cn } from "~/lib/utils";

import { type Shortcut } from "~/lib/keyboard/shortcuts";

/**
 * A single physical key.
 *
 * Squared like everything else in this system, with a hairline bottom edge so
 * it reads as a key cap without a drop shadow.
 */
export function Kbd({
  children,
  tone = "paper",
  className,
}: {
  children: React.ReactNode;
  tone?: "paper" | "stage";
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[1.45rem] min-w-[1.45rem] items-center justify-center rounded-xs border border-b-2 px-1.5 font-mono text-[0.6875rem] font-medium",
        tone === "stage"
          ? "border-stage-line bg-stage-raised text-stage-ink"
          : "border-line bg-paper text-ink",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** A shortcut's keys, with its alternates after an "or". */
export function KbdCombo({
  shortcut,
  tone = "paper",
  className,
}: {
  shortcut: Pick<Shortcut, "keys" | "alternates">;
  tone?: "paper" | "stage";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {shortcut.keys.map((key) => (
        <Kbd key={key} tone={tone}>
          {key}
        </Kbd>
      ))}
      {shortcut.alternates?.length ? (
        <>
          <span
            className={cn(
              "text-[0.6875rem]",
              tone === "stage" ? "text-stage-muted" : "text-faint",
            )}
          >
            or
          </span>
          {shortcut.alternates.map((key) => (
            <Kbd key={key} tone={tone}>
              {key}
            </Kbd>
          ))}
        </>
      ) : null}
    </span>
  );
}
