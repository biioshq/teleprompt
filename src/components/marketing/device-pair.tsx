import {
  ArrowCounterClockwise,
  CaretDown,
  CaretUp,
  Lightning,
  Pause,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "~/lib/utils";

/**
 * The landing-page demo: a display and a remote showing the same script.
 *
 * Both panels scroll by the same number of `em` over the same duration, so a
 * 15px column and an 11px column stay on the same line throughout. That is not
 * a trick for the marketing page — it is exactly the property the product is
 * built on, just expressed in CSS instead of TypeScript.
 */

type Line = { text: string; cue?: boolean };

const SCRIPT: Line[] = [
  { text: "Good evening, and thank you for making the time." },
  { text: "Tonight I want to talk about one small thing." },
  { text: "look at the lens, not the screen", cue: true },
  { text: "Every product starts as a sentence someone said out loud." },
  { text: "Before the deck. Before the first line of code." },
  { text: "Somebody stood up and said it badly to three people." },
  { text: "slow down, let it land", cue: true },
  { text: "Our job is to keep that sentence intact." },
  { text: "Through every handoff, every rewrite, every sprint." },
  { text: "That is the whole idea. Thank you." },
];

const LINE_COUNT = SCRIPT.length;
const DURATION = "34s";

function ScrollingScript({
  fontSize,
  readingLineOffset,
  className,
}: {
  fontSize: number;
  readingLineOffset: number;
  className?: string;
}) {
  return (
    <div
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={
        {
          "--tp-demo-lines": LINE_COUNT,
          "--tp-demo-duration": DURATION,
        } as React.CSSProperties
      }
    >
      <div
        className="animate-prompter absolute inset-x-0 top-0"
        style={{
          fontSize,
          lineHeight: 1.75,
          paddingTop: readingLineOffset,
        }}
      >
        {/* Rendered twice so the loop has no seam. */}
        {[0, 1].map((copy) =>
          SCRIPT.map((line, index) => (
            <p
              key={`${copy}-${index}`}
              className={cn(
                "truncate px-4 font-medium tracking-[-0.01em]",
                line.cue
                  ? "font-mono text-[0.72em] tracking-[0.08em] text-brand uppercase opacity-90"
                  : "text-stage-ink opacity-45",
              )}
            >
              {line.cue ? `:: ${line.text}` : line.text}
            </p>
          )),
        )}
      </div>

      {/* Edge fades, so the eye is pulled to the reading line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, #0b0b0c 0%, transparent 22%, transparent 76%, #0b0b0c 100%)",
        }}
      />

      {/* The reading line itself. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 flex items-center gap-2 px-3"
        style={{ top: readingLineOffset + fontSize * 0.85 }}
      >
        <span className="h-0 w-0 border-y-[5px] border-l-[7px] border-y-brand/0 border-y-transparent border-l-brand" />
        <span className="h-px flex-1 bg-brand opacity-30" />
      </div>
    </div>
  );
}

export function DevicePair({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden>
      {/* Display ---------------------------------------------------------- */}
      <div className="rounded-lg border border-ink bg-ink p-2 shadow-hard-lg">
        <div className="relative h-[19rem] overflow-hidden rounded-md bg-stage">
          <ScrollingScript fontSize={17} readingLineOffset={118} />

          <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 py-2.5">
            <span className="font-mono text-[0.5625rem] tracking-[0.16em] text-stage-muted uppercase">
              Display
            </span>
            <span className="ml-auto inline-flex items-center gap-1">
              <Lightning size={10} weight="bold" className="text-brand" />
              <span className="font-mono text-[0.5625rem] tracking-[0.12em] text-stage-muted uppercase">
                Direct · 4ms
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between px-1">
        <span className="font-mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">
          The screen they see
        </span>
        <span className="font-mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">
          K7M-2QF
        </span>
      </div>

      {/* Remote ----------------------------------------------------------- */}
      <div className="absolute -right-4 -bottom-16 w-[10.5rem] sm:-right-10 sm:w-[11.5rem]">
        <div className="rounded-xl border border-ink bg-ink p-1.5 shadow-hard-lg">
          <div className="relative h-[15rem] overflow-hidden rounded-lg bg-stage">
            <ScrollingScript fontSize={11} readingLineOffset={76} />

            <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 px-2.5 py-2">
              <span className="inline-block h-1 w-1 rounded-full bg-brand" />
              <span className="font-mono text-[0.5rem] tracking-[0.16em] text-stage-muted uppercase">
                Remote
              </span>
            </div>

            {/* Controls */}
            <div className="absolute inset-x-0 bottom-0 border-t border-stage-line bg-stage px-3 py-3">
              <div className="h-[2px] w-full overflow-hidden rounded-full bg-stage-line">
                <div className="h-full w-[38%] bg-brand" />
              </div>
              <div className="mt-2.5 flex items-center justify-center gap-2.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-stage-line text-stage-muted">
                  <ArrowCounterClockwise size={9} weight="bold" />
                </span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-stage-line text-stage-ink">
                  <CaretUp size={10} weight="bold" />
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-ink">
                  <Pause size={13} weight="fill" />
                </span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-stage-line text-stage-ink">
                  <CaretDown size={10} weight="bold" />
                </span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-stage-line font-mono text-[0.5rem] text-stage-muted">
                  ½
                </span>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center font-mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">
          The one you hold
        </p>
      </div>
    </div>
  );
}
