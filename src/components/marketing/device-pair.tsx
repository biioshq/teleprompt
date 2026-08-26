"use client";

import {
  ArrowCounterClockwise,
  CaretDown,
  CaretUp,
  Lightning,
  Pause,
  Play,
} from "@phosphor-icons/react/dist/ssr";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "~/lib/utils";

/**
 * The landing-page demo: a display, and the remote that drives it.
 *
 * It is a small working prompter rather than a looping picture of one. The
 * transport under the remote does what it says, a line can be tapped to jump
 * to it, the bar scrubs. The shortest explanation of a remote control is
 * letting someone hold it.
 *
 * One position drives both panels. They render it at 17px and at 11px and stay
 * on the same line throughout, because position is carried as a line number
 * and spent in `em`, never in pixels. That is not a trick for the marketing
 * page: it is the property the product is built on, expressed here in one
 * component instead of across a network.
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

/**
 * Every row is exactly this tall, whatever size the text inside it is set at.
 *
 * A cue is typeset several sizes down, and a row that simply inherited a
 * unitless `line-height` would therefore be shorter than a spoken one. The
 * scroll is a count of lines, so uneven rows put every line after the first
 * cue off the reading line and leave a visible jolt at the loop. Fixing the
 * row and letting the type float inside it keeps the two independent.
 */
const LINE_HEIGHT = 1.75;

/** Cues are never spoken, so they are not words the pace has to pay for. */
const SPOKEN_WORDS = SCRIPT.reduce(
  (total, line) =>
    line.cue ? total : total + line.text.trim().split(/\s+/).length,
  0,
);

/** Where the demo is parked before anyone touches it. */
const OPENING_LINE = 3;

const BASE_WPM = 130;
const PACES = [
  { multiplier: 0.5, label: "½×" },
  { multiplier: 1, label: "1×" },
  { multiplier: 2, label: "2×" },
];
const DEFAULT_PACE_INDEX = 1;

function paceAt(index: number) {
  return PACES[index] ?? { multiplier: 1, label: "1×" };
}

/**
 * Lines per second at a reading pace.
 *
 * The real engine converts words per minute into pixels per second against the
 * measured height of the script. Same conversion, in the one unit this demo
 * has: a line.
 */
function linesPerSecond(wpm: number) {
  return (wpm / 60) * (LINE_COUNT / SPOKEN_WORDS);
}

/** How far a finger may travel before a tap becomes a scrub. */
const TAP_SLOP = 6;

/** A jump is eased rather than cut, and longer jumps take longer. */
const GLIDE_BASE_MS = 120;
const GLIDE_PER_LINE_MS = 34;
const GLIDE_MAX_MS = 420;

function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * Position runs unbounded, so a jump can always take the short way round.
 * The panels only ever paint it modulo one pass of the script.
 */
function wrap(position: number) {
  return ((position % LINE_COUNT) + LINE_COUNT) % LINE_COUNT;
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                 */
/* -------------------------------------------------------------------------- */

type Glide = { from: number; to: number; start: number; span: number };

/**
 * Position lives in a ref and is painted straight onto the DOM from a rAF
 * loop, exactly as the real prompter does it: sixty frames a second of scroll
 * should not be sixty React renders. Only the things a person can see the
 * state of (the play icon, the pace) are state.
 */
function usePrompterDemo() {
  const root = useRef<HTMLDivElement | null>(null);
  const panels = useRef(new Set<HTMLElement>());
  const fill = useRef<HTMLDivElement | null>(null);
  const slider = useRef<HTMLDivElement | null>(null);

  const position = useRef(OPENING_LINE);
  const activeLine = useRef(-1);
  const glide = useRef<Glide | null>(null);
  const playing = useRef(true);
  const onScreen = useRef(true);
  const reduced = useRef(false);
  const speed = useRef(linesPerSecond(BASE_WPM));

  const wake = useRef<() => void>(() => undefined);
  const mark = useRef<(attribute: string, index: number | null) => void>(
    () => undefined,
  );

  const [isPlaying, setIsPlaying] = useState(true);
  const [paceIndex, setPaceIndex] = useState(DEFAULT_PACE_INDEX);

  const registerPanel = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    panels.current.add(element);
    return () => {
      panels.current.delete(element);
    };
  }, []);

  useEffect(() => {
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    /* Nothing in the hero should move on its own for someone who has asked
       for that. The controls still work; this only decides whether it starts
       playing and whether a jump is eased or cut. */
    if (reduced.current) {
      playing.current = false;
      setIsPlaying(false);
    }

    let frame: number | null = null;
    let previous = 0;

    mark.current = (attribute, index) => {
      panels.current.forEach((panel) => {
        panel
          .querySelectorAll<HTMLElement>(`[${attribute}]`)
          .forEach((row) => row.removeAttribute(attribute));
        if (index === null) return;
        panel
          .querySelectorAll<HTMLElement>(`[data-tp-line="${index}"]`)
          .forEach((row) => row.setAttribute(attribute, ""));
      });
    };

    const paint = () => {
      const at = wrap(position.current);

      /* The same string for both panels. `em` resolves against each panel's
         own type size, so one declaration moves a 17px column and an 11px
         column onto the same line. */
      const transform = `translate3d(0, ${(-at * LINE_HEIGHT).toFixed(4)}em, 0)`;
      panels.current.forEach((panel) => {
        panel.style.transform = transform;
      });
      if (fill.current) {
        fill.current.style.width = `${(at / LINE_COUNT) * 100}%`;
      }

      const index = Math.round(at) % LINE_COUNT;
      if (index === activeLine.current) return;
      activeLine.current = index;
      mark.current("data-tp-active", index);

      const line = SCRIPT[index];
      slider.current?.setAttribute("aria-valuenow", String(index + 1));
      slider.current?.setAttribute(
        "aria-valuetext",
        line ? (line.cue ? `Cue: ${line.text}` : line.text) : "",
      );
    };

    /* A hero that keeps a rAF loop alive while it is scrolled past, or behind
       a tab nobody is looking at, is a battery bug with a nice gradient. */
    const shouldRun = () =>
      glide.current !== null ||
      (playing.current && onScreen.current && !document.hidden);

    const tick = (now: number) => {
      frame = null;
      const elapsed =
        previous === 0 ? 0 : Math.min(0.05, (now - previous) / 1000);
      previous = now;

      const move = glide.current;
      if (move) {
        const progress =
          move.span <= 0 ? 1 : Math.min(1, (now - move.start) / move.span);
        position.current =
          move.from + (move.to - move.from) * easeOutQuint(progress);
        if (progress >= 1) {
          position.current = move.to;
          glide.current = null;
        }
      } else if (playing.current && onScreen.current && !document.hidden) {
        position.current += speed.current * elapsed;
      }

      paint();
      if (shouldRun()) frame = requestAnimationFrame(tick);
      else previous = 0;
    };

    /* Everything that changes position calls this. When the loop is already
       running it does nothing; when it is not, it buys exactly one frame, so
       a scrub repaints without the demo having to idle at 60fps to be ready. */
    const start = () => {
      if (frame !== null) return;
      previous = 0;
      frame = requestAnimationFrame(tick);
    };
    wake.current = start;

    paint();
    start();

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        onScreen.current = entry ? entry.isIntersecting : true;
        if (onScreen.current) start();
      },
      { threshold: 0 },
    );
    if (root.current) observer.observe(root.current);

    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    speed.current = linesPerSecond(BASE_WPM * paceAt(paceIndex).multiplier);
    wake.current();
  }, [paceIndex]);

  const glideTo = useCallback((to: number) => {
    if (reduced.current) {
      glide.current = null;
      position.current = to;
    } else {
      glide.current = {
        from: position.current,
        to,
        start: performance.now(),
        span: Math.min(
          GLIDE_MAX_MS,
          GLIDE_BASE_MS + Math.abs(to - position.current) * GLIDE_PER_LINE_MS,
        ),
      };
    }
    wake.current();
  }, []);

  const toggle = useCallback(() => {
    playing.current = !playing.current;
    setIsPlaying(playing.current);
    wake.current();
  }, []);

  /** Back to the top of the take, not back a whole loop. */
  const restart = useCallback(() => {
    glideTo(Math.floor(position.current / LINE_COUNT) * LINE_COUNT);
  }, [glideTo]);

  /** Stepping is measured from the line on the reading line, not from the
      fraction the scroll happens to be at. */
  const step = useCallback(
    (delta: number) => glideTo(Math.round(position.current) + delta),
    [glideTo],
  );

  const cyclePace = useCallback(() => {
    setPaceIndex((index) => (index + 1) % PACES.length);
  }, []);

  /** Hand scrubbing: a delta, applied on top of wherever playback has got to. */
  const scrub = useCallback((lines: number) => {
    glide.current = null;
    position.current += lines;
    wake.current();
  }, []);

  /**
   * Tap to jump. The row says which of the two rendered copies it belongs to,
   * so the line under the finger comes to the reading line by the short way
   * round rather than winding the script back to its first copy.
   */
  const jumpTo = useCallback(
    (copy: number, index: number) => {
      glideTo(
        position.current + (copy * LINE_COUNT + index - wrap(position.current)),
      );
    },
    [glideTo],
  );

  const seekFraction = useCallback((fraction: number) => {
    const clamped = Math.max(0, Math.min(1, fraction));
    glide.current = null;
    position.current =
      Math.floor(position.current / LINE_COUNT) * LINE_COUNT +
      clamped * LINE_COUNT;
    wake.current();
  }, []);

  const hover = useCallback((index: number | null) => {
    mark.current("data-tp-hover", index);
  }, []);

  return {
    root,
    registerPanel,
    fill,
    slider,
    isPlaying,
    pace: paceAt(paceIndex),
    toggle,
    restart,
    step,
    cyclePace,
    scrub,
    jumpTo,
    seekFraction,
    hover,
  };
}

/* -------------------------------------------------------------------------- */
/* A panel                                                                    */
/* -------------------------------------------------------------------------- */

type Drive = {
  onTap: (copy: number, index: number) => void;
  onScrub: (lines: number) => void;
  onHover: (index: number | null) => void;
};

function rowAt(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLElement>("[data-tp-line]")
    : null;
}

/**
 * Memoised, and given only stable props: once it is mounted the engine owns
 * every pixel of it, and a re-render here would be twenty rows rebuilt for a
 * play icon that lives somewhere else.
 */
const ScrollingScript = memo(function ScrollingScript({
  fontSize,
  readingLineOffset,
  register,
  drive,
}: {
  fontSize: number;
  readingLineOffset: number;
  register: (element: HTMLDivElement | null) => (() => void) | void;
  drive?: Drive;
}) {
  const pitch = fontSize * LINE_HEIGHT;
  const gesture = useRef<{
    origin: number;
    last: number;
    moved: boolean;
    row: HTMLElement | null;
  } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drive || !event.isPrimary) return;
    /* The row is read now: once the pointer is captured every later event
       reports the capturing element as its target, not the line under it. */
    gesture.current = {
      origin: event.clientY,
      last: event.clientY,
      moved: false,
      row: rowAt(event.target),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drive) return;
    const active = gesture.current;
    if (!active) {
      const row = rowAt(event.target);
      drive.onHover(row ? Number(row.dataset.tpLine) : null);
      return;
    }
    if (!active.moved) {
      if (Math.abs(event.clientY - active.origin) < TAP_SLOP) return;
      active.moved = true;
      active.last = event.clientY;
      return;
    }
    const travelled = event.clientY - active.last;
    active.last = event.clientY;
    drive.onScrub(-travelled / pitch);
  };

  const endGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    gesture.current = null;
    if (!drive || !active) return;
    if (event.type === "pointerup" && !active.moved && active.row) {
      drive.onTap(
        Number(active.row.dataset.tpCopy),
        Number(active.row.dataset.tpLine),
      );
    }
  };

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden",
        drive && "cursor-pointer",
      )}
      /* `pan-y` rather than `none`: a mouse can still drag the script, and a
         finger that lands here while scrolling the page still scrolls the
         page. Tapping a line works under both. */
      style={drive ? { touchAction: "pan-y" } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onPointerLeave={() => drive?.onHover(null)}
    >
      <div className="tp-demo-fade absolute inset-0">
        <div
          ref={register}
          className="absolute inset-x-0 top-0 will-change-transform"
          style={{
            fontSize,
            paddingTop: readingLineOffset,
            /* Matches the engine's opening position, so the server's markup
               and the first painted frame are the same picture. */
            transform: `translate3d(0, ${-OPENING_LINE * LINE_HEIGHT}em, 0)`,
          }}
        >
          {/* Rendered twice, so the loop has no seam. */}
          {[0, 1].map((copy) =>
            SCRIPT.map((line, index) => (
              <div
                key={`${copy}-${index}`}
                data-tp-line={index}
                data-tp-copy={copy}
                className="tp-demo-line flex items-center px-4 leading-tight"
                style={{ height: `${LINE_HEIGHT}em` }}
              >
                {line.cue ? (
                  /* A cue the way the script was written: the `::` that marks
                     one in Markdown, kept as its own glyph rather than folded
                     into the sentence. */
                  <span className="flex min-w-0 items-baseline gap-[0.4em] text-brand">
                    <span
                      aria-hidden
                      className="shrink-0 font-mono text-[0.66em]"
                    >
                      ::
                    </span>
                    <span className="min-w-0 truncate font-mono text-[0.66em] tracking-[0.08em] uppercase">
                      {line.text}
                    </span>
                  </span>
                ) : (
                  <span className="min-w-0 truncate font-medium tracking-[-0.01em] text-stage-ink">
                    {line.text}
                  </span>
                )}
              </div>
            )),
          )}
        </div>
      </div>

      {/* The reading line itself, centred on the row that sits under it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 flex items-center gap-2 px-3"
        style={{
          top: readingLineOffset + pitch / 2,
          transform: "translateY(-50%)",
        }}
      >
        <span className="h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-brand" />
        <span className="h-px flex-1 bg-brand opacity-30" />
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* The remote's transport                                                     */
/* -------------------------------------------------------------------------- */

function RemoteButton({
  label,
  onClick,
  tone = "muted",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "muted" | "ink";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stage-line transition-colors focus-visible:outline-brand active:scale-95",
        tone === "ink"
          ? "text-stage-ink hover:border-brand hover:text-brand"
          : "text-stage-muted hover:border-stage-muted hover:text-stage-ink",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* The pair                                                                   */
/* -------------------------------------------------------------------------- */

export function DevicePair({ className }: { className?: string }) {
  const {
    root,
    registerPanel,
    fill,
    slider,
    isPlaying,
    pace,
    toggle,
    restart,
    step,
    cyclePace,
    scrub,
    jumpTo,
    seekFraction,
    hover,
  } = usePrompterDemo();

  const drive = useMemo<Drive>(
    () => ({ onTap: jumpTo, onScrub: scrub, onHover: hover }),
    [jumpTo, scrub, hover],
  );

  const scrubbing = useRef(false);

  const seekFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    seekFraction((event.clientX - bounds.left) / bounds.width);
  };

  const onBarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    if (back || forward) {
      event.preventDefault();
      step(forward ? 1 : -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      restart();
    } else if (event.key === "End") {
      event.preventDefault();
      seekFraction((LINE_COUNT - 1) / LINE_COUNT);
    }
  };

  return (
    <div
      ref={root}
      role="group"
      aria-label="Demo: a display, and the remote that drives it"
      className={cn("relative", className)}
    >
      <p className="sr-only">
        Both panels are showing the same script at different type sizes. The
        remote&rsquo;s controls drive them together.
      </p>

      {/* Display ---------------------------------------------------------- */}
      <div className="rounded-lg border border-ink bg-ink p-2 shadow-hard-lg">
        <div
          aria-hidden
          className="relative h-[19rem] overflow-hidden rounded-md bg-stage"
        >
          <ScrollingScript
            fontSize={17}
            readingLineOffset={118}
            register={registerPanel}
          />

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
            <ScrollingScript
              fontSize={11}
              readingLineOffset={76}
              register={registerPanel}
              drive={drive}
            />

            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-1.5 px-2.5 py-2"
            >
              <span
                className={cn(
                  "inline-block h-1 w-1 shrink-0 rounded-full bg-brand",
                  isPlaying && "animate-live",
                )}
              />
              <span className="font-mono text-[0.5rem] tracking-[0.16em] text-stage-muted uppercase">
                Remote
              </span>
              <span className="ml-auto font-mono text-[0.5rem] tracking-[0.08em] text-stage-muted uppercase tabular">
                {Math.round(BASE_WPM * pace.multiplier)} wpm
              </span>
            </div>

            {/* Controls */}
            <div className="absolute inset-x-0 bottom-0 border-t border-stage-line bg-stage px-3 py-3">
              <div
                ref={slider}
                role="slider"
                tabIndex={0}
                aria-label="Position in the script"
                aria-orientation="horizontal"
                aria-valuemin={1}
                aria-valuemax={LINE_COUNT}
                aria-valuenow={OPENING_LINE + 1}
                className="-my-1.5 cursor-pointer py-1.5 focus-visible:outline-brand"
                style={{ touchAction: "none" }}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  scrubbing.current = true;
                  seekFromPointer(event);
                }}
                onPointerMove={(event) => {
                  if (scrubbing.current) seekFromPointer(event);
                }}
                onPointerUp={() => {
                  scrubbing.current = false;
                }}
                onPointerCancel={() => {
                  scrubbing.current = false;
                }}
                onKeyDown={onBarKeyDown}
              >
                <div className="h-[2px] w-full overflow-hidden rounded-full bg-stage-line">
                  <div
                    ref={fill}
                    className="h-full bg-brand"
                    style={{ width: `${(OPENING_LINE / LINE_COUNT) * 100}%` }}
                  />
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-center gap-2.5">
                <RemoteButton label="Back to the top" onClick={restart}>
                  <ArrowCounterClockwise size={9} weight="bold" />
                </RemoteButton>
                <RemoteButton
                  label="Previous line"
                  tone="ink"
                  onClick={() => step(-1)}
                >
                  <CaretUp size={10} weight="bold" />
                </RemoteButton>

                <button
                  type="button"
                  onClick={toggle}
                  title={isPlaying ? "Pause" : "Play"}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-ink transition-transform focus-visible:outline-brand active:scale-95"
                >
                  {isPlaying ? (
                    <Pause size={13} weight="fill" />
                  ) : (
                    <Play size={13} weight="fill" />
                  )}
                </button>

                <RemoteButton
                  label="Next line"
                  tone="ink"
                  onClick={() => step(1)}
                >
                  <CaretDown size={10} weight="bold" />
                </RemoteButton>
                <RemoteButton
                  label={`Reading pace: ${pace.label}, ${Math.round(BASE_WPM * pace.multiplier)} words a minute`}
                  onClick={cyclePace}
                >
                  <span className="font-mono text-[0.5rem]">{pace.label}</span>
                </RemoteButton>
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
