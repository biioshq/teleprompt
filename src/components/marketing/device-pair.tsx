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
 *
 * The pair also stands in a scene rather than on a page. Bring a mouse near it
 * and both panels turn together under one lens, the remote a little in front
 * of the display, so the two slide against each other by however much the
 * depth between them is worth. `globals.css` holds the camera; this file only
 * says where the pointer is.
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

/**
 * The depth of field around the reading line.
 *
 * A prompter is read at one line, and the eye should be able to find that line
 * without hunting for it. The panels already dim and fade what is away from
 * it; these put it out of focus as well, which is the cue a lens gives and the
 * one the flat version of this was missing.
 *
 * The column is drawn three times at three focal depths, and each copy is
 * masked to the band of distance it is responsible for. Neighbouring bands
 * share a ramp, so a row crossing between them is a cross-fade rather than a
 * step, and the blur a row carries is how far it is from being read.
 *
 * The obvious way to do this is one `backdrop-filter` per depth over a single
 * column, and it works right up until the pair is put under the camera: a
 * transformed ancestor makes a backdrop root, and inside one the mask stops
 * clipping the filter, so every line blurs at full strength the moment the
 * hero is hovered. Blurring real content instead has no such rule.
 *
 * `inner`/`outer` are the ramps in `em`, measured from the reading line, so
 * the 17px panel and the 11px panel are blurred by the same amount of reading
 * rather than the same number of pixels. `null` means the band runs all the
 * way in to the reading line, or all the way out to the edge.
 */
const FOCUS_BANDS: {
  blur: number;
  inner: [number, number] | null;
  outer: [number, number] | null;
}[] = [
  { blur: 0, inner: null, outer: [1.1, 2.5] },
  { blur: 0.055, inner: [1.1, 2.5], outer: [3.3, 4.7] },
  { blur: 0.15, inner: [3.3, 4.7], outer: null },
];

/**
 * One band's mask: opaque across the slice of the panel that band owns, and
 * ramped to nothing across the slice it shares with its neighbour.
 */
function bandMask(
  band: (typeof FOCUS_BANDS)[number],
  readingLine: number,
  fontSize: number,
) {
  const at = (offset: number) =>
    `${(readingLine + offset * fontSize).toFixed(1)}px`;
  const stops: string[] = [];

  if (band.outer)
    stops.push(
      `transparent ${at(-band.outer[1])}`,
      `#000 ${at(-band.outer[0])}`,
    );
  else stops.push("#000 0%");

  if (band.inner) {
    stops.push(
      `#000 ${at(-band.inner[1])}`,
      `transparent ${at(-band.inner[0])}`,
      `transparent ${at(band.inner[0])}`,
      `#000 ${at(band.inner[1])}`,
    );
  }

  if (band.outer)
    stops.push(`#000 ${at(band.outer[0])}`, `transparent ${at(band.outer[1])}`);
  else stops.push("#000 100%");

  return `linear-gradient(to bottom, ${stops.join(", ")})`;
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
  /** Where the row being read sits, measured from the top of the panel. */
  const readingLine = readingLineOffset + pitch / 2;
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
        {/* One column per focal depth. Every copy registers, so the engine
            drives all of them with the one transform it already writes and
            they cannot drift apart. The blur sits on the same element the
            engine transforms, which keeps the filtered result static and
            leaves the scroll a compositor move rather than a re-filter. */}
        {FOCUS_BANDS.map((band, depth) => (
          <div
            key={band.blur}
            className={cn(
              "absolute inset-0",
              depth > 0 && "pointer-events-none",
            )}
            data-tp-band={depth}
            style={{ maskImage: bandMask(band, readingLine, fontSize) }}
          >
            <div
              ref={register}
              className="absolute inset-x-0 top-0 will-change-transform"
              style={{
                fontSize,
                paddingTop: readingLineOffset,
                filter: band.blur
                  ? `blur(${(band.blur * fontSize).toFixed(2)}px)`
                  : undefined,
                /* Matches the engine's opening position, so the server's
                   markup and the first painted frame are the same picture. */
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
                      /* Labelled, not punctuated. `::` is how a cue is written
                         in Markdown; the word is what the prompter puts on
                         screen when it reads one. Same two spans, same sizes
                         and tracking as the real block in `script-blocks.tsx`,
                         so the demo goes on being the product rather than a
                         drawing of it. */
                      <span className="flex min-w-0 items-baseline gap-[0.5em] text-brand">
                        <span className="shrink-0 font-mono text-[0.5em] tracking-[0.2em] uppercase">
                          cue
                        </span>
                        <span className="min-w-0 truncate font-mono text-[0.58em] tracking-[0.02em] uppercase">
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
        ))}
      </div>

      {/* The reading line itself, centred on the row that sits under it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 flex items-center gap-2 px-3"
        style={{ top: readingLine, transform: "translateY(-50%)" }}
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
/* The camera                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * How far the scene turns when the pointer is at the edge of the pair.
 *
 * Small on purpose. What this buys is about ten pixels of difference between
 * the near and far edges of the display, which is enough to see a panel as a
 * panel, and roughly six pixels of slide between the two screens. Past that it
 * stops reading as depth and starts reading as an effect.
 */
const MAX_YAW = 3.6;
const MAX_PITCH = 2.2;

/** Longer than the CSS transition, so the pose has landed before it is let go. */
const CAMERA_SETTLE_MS = 420;

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

/**
 * The pointer, turned into two angles on the pair's root.
 *
 * Everything else about the scene lives in `globals.css`: the lens, the depth
 * of each plane, and the scale that depth has to be corrected by. They are
 * only meaningful as a set, so they are kept as one.
 *
 * The angles are written to the root and never to a panel. The engine above
 * owns `transform` on both scrolling columns and overwrites it sixty times a
 * second, and the root itself is under `animate-rise`, whose last keyframe is
 * `transform: none` and whose fill is `both` — an animation holding a property
 * beats an inline style on the same element, silently and forever.
 */
function useCamera(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;

    /* A touch screen has no hover: `pointermove` arrives only with a finger
       down, which on this component is the middle of a scrub. And someone who
       has asked for less motion has not asked for a camera. */
    if (
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let bounds: DOMRect | null = null;
    let pointer: { x: number; y: number } | null = null;
    let frame: number | null = null;
    let settle: number | null = null;
    let live = false;
    let held = false;
    let stale = true;

    /* Scrolling moves the pair under a pointer that has not moved, so the pose
       it was struck for is no longer the right one. Flagging rather than
       measuring here keeps the layout read out of the scroll handler: the
       engine beside this writes a percentage width to the progress fill every
       frame, which dirties layout, so a rect read from an event handler forces
       a full synchronous re-layout of the page to answer it. */
    const invalidate = () => {
      stale = true;
      if (live && frame === null) frame = requestAnimationFrame(pose);
    };

    const pose = () => {
      frame = null;
      if (!live || !pointer) return;
      if (stale) {
        bounds = element.getBoundingClientRect();
        stale = false;
      }
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

      const nx = clampUnit(((pointer.x - bounds.left) / bounds.width) * 2 - 1);
      const ny = clampUnit(((pointer.y - bounds.top) / bounds.height) * 2 - 1);

      /* The side the pointer is on comes forward, the way you tip something on
         a desk towards you to look at it. */
      element.style.setProperty("--tp-yaw", `${(-MAX_YAW * nx).toFixed(2)}deg`);
      element.style.setProperty(
        "--tp-pitch",
        `${(MAX_PITCH * ny).toFixed(2)}deg`,
      );
    };

    const mount = () => {
      if (live) return;
      live = true;
      if (settle !== null) {
        window.clearTimeout(settle);
        settle = null;
      }
      stale = true;
      window.addEventListener("scroll", invalidate, { passive: true });
      window.addEventListener("resize", invalidate);
      element.setAttribute("data-tp-cam", "");
    };

    const unmount = () => {
      if (!live) return;
      live = false;
      pointer = null;
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
      element.style.setProperty("--tp-yaw", "0deg");
      element.style.setProperty("--tp-pitch", "0deg");

      /* Square is not the same as absent. The planes stay in the camera's
         coordinate system until the pose has finished easing back, and are
         handed over to the ordinary painter only then, because that is the one
         that renders eight-pixel type without resampling it. */
      settle = window.setTimeout(() => {
        settle = null;
        element.removeAttribute("data-tp-cam");
      }, CAMERA_SETTLE_MS);
    };

    const onMove = (event: PointerEvent) => {
      if (held || event.pointerType === "touch") return;
      mount();
      pointer = { x: event.clientX, y: event.clientY };
      if (frame === null) frame = requestAnimationFrame(pose);
    };

    const onLeave = (event: PointerEvent) => {
      if (held || event.pointerType === "touch") return;
      unmount();
    };

    /* The pose is frozen for the length of a gesture. Capturing a pointer does
       not stop its moves reaching this element, so without this the pair would
       turn under the very finger dragging the scrub bar, and the bar would
       slide out from under it. */
    const onDown = (event: PointerEvent) => {
      /* Only a primary press is a gesture. A right-click opens a menu that
         swallows its own release, and a latch nothing clears would leave the
         pair frozen at whatever angle it was caught at. */
      if (!event.isPrimary || event.button !== 0) return;
      held = true;
    };

    /* On the window, and not on the pair. Most of what can be pressed here
       does not capture the pointer — the display panel is not driven, and a
       transport button is just a button — so a press that starts on the pair
       and is let go anywhere else never comes back to the element at all. A
       latch left standing would freeze the pose, hold both planes on the
       composited path, and make every later approach do nothing. */
    const onUp = (event: PointerEvent) => {
      if (!held) return;
      held = false;
      /* A cancelled pointer reports where it was last seen, or nothing at all,
         so it is treated as gone rather than trusted. */
      if (event.type === "pointercancel") {
        unmount();
        return;
      }
      const under = document.elementFromPoint(event.clientX, event.clientY);
      if (!under || !element.contains(under)) unmount();
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    element.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);

    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      element.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
      if (frame !== null) cancelAnimationFrame(frame);
      if (settle !== null) window.clearTimeout(settle);
      element.removeAttribute("data-tp-cam");
    };
  }, [root]);
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

  useCamera(root);

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
      className={cn("tp-demo-camera relative", className)}
    >
      <p className="sr-only">
        Both panels are showing the same script at different type sizes. The
        remote&rsquo;s controls drive them together.
      </p>

      {/* Display ---------------------------------------------------------- */}
      {/* The card and the line that labels it are one plane: a caption
          left behind by the card it belongs to would read as a bug in a
          layout built on flush alignment. */}
      <div className="tp-demo-far">
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
      </div>

      {/* Remote ----------------------------------------------------------- */}
      {/* The near plane is the full size of the pair, so that it turns
          about the same point the far one does. The remote keeps its own
          offsets inside it, against a box that is exactly the one it used
          to hang off.

          The overhang is smaller than the gutter below `sm`, so that the
          deeper shadow this card carries lands on paper rather than being
          cut in half by the edge of a phone. */}
      <div className="tp-demo-near pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute -right-2 -bottom-16 w-[10.5rem] sm:-right-10 sm:w-[11.5rem]">
          <div className="rounded-xl border border-ink bg-ink p-1.5 shadow-hard-xl">
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
                    <span className="font-mono text-[0.5rem]">
                      {pace.label}
                    </span>
                  </RemoteButton>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center font-mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">
            The one you hold
          </p>
        </div>
      </div>
    </div>
  );
}
