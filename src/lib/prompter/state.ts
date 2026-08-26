import { z } from "zod";

/**
 * Both devices render the same script, but they almost never share a viewport,
 * a font size, or an orientation. Syncing a raw `scrollTop` would therefore put
 * a phone and a laptop on different sentences.
 *
 * Instead we sync a *text anchor*: which block is currently under the reading
 * line, and how far through that block we are. Every device resolves that back
 * to its own pixel offset. Whatever a device's geometry, the same words sit on
 * the reading line, which is the whole point of the product.
 */
export const anchorSchema = z.object({
  /** Index into the block list produced by `splitIntoBlocks()`. */
  blockIndex: z.number().int().min(0),
  /** 0 = block's first line at the reading line, 1 = its last. */
  blockFraction: z.number().min(0).max(1),
});

export type Anchor = z.infer<typeof anchorSchema>;

export const PROMPTER_THEMES = ["night", "amber", "paper"] as const;
export type PrompterTheme = (typeof PROMPTER_THEMES)[number];

/**
 * Theme tokens are duplicated here (rather than living only in CSS) because the
 * prompter surface is painted inline: it has to be correct on the very first
 * frame, before any stylesheet-dependent class transition can run.
 */
export const THEME_TOKENS: Record<
  PrompterTheme,
  { bg: string; fg: string; dim: string; rule: string; label: string }
> = {
  night: {
    bg: "#0b0b0c",
    fg: "#f6f5f3",
    dim: "#6f6f74",
    rule: "#ff8800",
    label: "Night",
  },
  amber: {
    bg: "#0a0805",
    fg: "#ffb454",
    dim: "#6b5230",
    rule: "#ff8800",
    label: "Amber",
  },
  paper: {
    bg: "#fff9f4",
    fg: "#1a1a1b",
    dim: "#8b857b",
    rule: "#ff8800",
    label: "Paper",
  },
};

export const LIMITS = {
  speedWpm: { min: 40, max: 320, step: 5 },
  fontSize: { min: 20, max: 160, step: 2 },
  lineHeight: { min: 1.1, max: 2.4, step: 0.05 },
  contentWidth: { min: 40, max: 100, step: 5 },
  readingLine: { min: 0.15, max: 0.7, step: 0.01 },
} as const;

export const prompterStateSchema = z.object({
  /** Where the reading line currently sits in the text. */
  anchor: anchorSchema,
  isPlaying: z.boolean(),

  /**
   * Target reading pace in words per minute. Converted to pixels/second at
   * render time using the measured height of the script, so the same WPM feels
   * identical on a phone and on a 27" display.
   */
  speedWpm: z.number().min(LIMITS.speedWpm.min).max(LIMITS.speedWpm.max),

  fontSize: z.number().min(LIMITS.fontSize.min).max(LIMITS.fontSize.max),
  lineHeight: z.number().min(LIMITS.lineHeight.min).max(LIMITS.lineHeight.max),
  contentWidth: z
    .number()
    .min(LIMITS.contentWidth.min)
    .max(LIMITS.contentWidth.max),
  /** Vertical position of the reading line as a fraction of viewport height. */
  readingLine: z
    .number()
    .min(LIMITS.readingLine.min)
    .max(LIMITS.readingLine.max),

  /** For shooting through beam-splitter glass. */
  flipHorizontal: z.boolean(),
  flipVertical: z.boolean(),

  showReadingLine: z.boolean(),
  theme: z.enum(PROMPTER_THEMES),

  /**
   * Whether a device in this room is listening to the reader and scrolling to
   * match. Shared rather than local: the remote has to be able to see that the
   * display is listening, and to say when it should stop.
   *
   * Defaulted rather than required so that a room saved before this existed
   * (and a device running a build from before it existed) still parses.
   */
  voiceTracking: z.boolean().default(false),

  /** Monotonic per-room counter. Higher revision wins on conflict. */
  revision: z.number().int().min(0),
  /** Epoch millis stamped by whichever device produced this revision. */
  updatedAt: z.number().int().min(0),
});

export type PrompterState = z.infer<typeof prompterStateSchema>;

/** The subset a remote is allowed to change without owning playback. */
export const prompterSettingsSchema = prompterStateSchema
  .pick({
    speedWpm: true,
    fontSize: true,
    lineHeight: true,
    contentWidth: true,
    readingLine: true,
    flipHorizontal: true,
    flipVertical: true,
    showReadingLine: true,
    theme: true,
  })
  .partial();

export type PrompterSettings = z.infer<typeof prompterSettingsSchema>;

/**
 * Bring a settings patch inside the allowed range before it goes anywhere.
 *
 * This matters more than it looks. `prompterSettingsSchema` rejects an
 * out-of-range value, `parseMessage` returns null for the whole envelope, and
 * the receiver drops it silently - so a font-size step taken at the maximum
 * did not clamp, it vanished. The display's own keystroke clamped on arrival
 * and the remote's did not, which is exactly the kind of difference that gets
 * reported as "it works on one device but not the other".
 */
export function clampSettings(patch: PrompterSettings): PrompterSettings {
  const out: PrompterSettings = { ...patch };
  if (out.speedWpm !== undefined) {
    out.speedWpm = clamp(
      Math.round(out.speedWpm),
      LIMITS.speedWpm.min,
      LIMITS.speedWpm.max,
    );
  }
  if (out.fontSize !== undefined) {
    out.fontSize = clamp(
      Math.round(out.fontSize),
      LIMITS.fontSize.min,
      LIMITS.fontSize.max,
    );
  }
  if (out.lineHeight !== undefined) {
    out.lineHeight = roundTo(
      clamp(out.lineHeight, LIMITS.lineHeight.min, LIMITS.lineHeight.max),
      2,
    );
  }
  if (out.contentWidth !== undefined) {
    out.contentWidth = clamp(
      Math.round(out.contentWidth),
      LIMITS.contentWidth.min,
      LIMITS.contentWidth.max,
    );
  }
  if (out.readingLine !== undefined) {
    out.readingLine = roundTo(
      clamp(out.readingLine, LIMITS.readingLine.min, LIMITS.readingLine.max),
      3,
    );
  }
  return out;
}

export const DEFAULT_PROMPTER_STATE: PrompterState = {
  anchor: { blockIndex: 0, blockFraction: 0 },
  isPlaying: false,
  speedWpm: 130,
  fontSize: 56,
  lineHeight: 1.5,
  contentWidth: 82,
  readingLine: 0.42,
  flipHorizontal: false,
  flipVertical: false,
  showReadingLine: true,
  theme: "night",
  voiceTracking: false,
  revision: 0,
  updatedAt: 0,
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Round to a sane number of decimals so floats stay stable over the wire. */
export function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function normaliseState(state: PrompterState): PrompterState {
  return {
    ...state,
    speedWpm: clamp(state.speedWpm, LIMITS.speedWpm.min, LIMITS.speedWpm.max),
    fontSize: clamp(state.fontSize, LIMITS.fontSize.min, LIMITS.fontSize.max),
    lineHeight: roundTo(
      clamp(state.lineHeight, LIMITS.lineHeight.min, LIMITS.lineHeight.max),
      2,
    ),
    contentWidth: clamp(
      state.contentWidth,
      LIMITS.contentWidth.min,
      LIMITS.contentWidth.max,
    ),
    readingLine: roundTo(
      clamp(state.readingLine, LIMITS.readingLine.min, LIMITS.readingLine.max),
      3,
    ),
    anchor: {
      blockIndex: Math.max(0, Math.round(state.anchor.blockIndex)),
      blockFraction: roundTo(clamp(state.anchor.blockFraction, 0, 1), 4),
    },
  };
}

/** Parse a value that came out of the database or off the wire, with fallback. */
export function parseState(value: unknown): PrompterState {
  const result = prompterStateSchema.safeParse(value);
  return result.success
    ? normaliseState(result.data)
    : { ...DEFAULT_PROMPTER_STATE };
}

export function anchorsEqual(a: Anchor, b: Anchor, tolerance = 0.002) {
  return (
    a.blockIndex === b.blockIndex &&
    Math.abs(a.blockFraction - b.blockFraction) < tolerance
  );
}

/**
 * A rough reading time, used on the dashboard and in the room header. 130 wpm
 * is a comfortable spoken-delivery pace, not a silent-reading pace.
 */
export function readingTimeSeconds(wordCount: number, wpm = 130) {
  if (wordCount <= 0) return 0;
  return Math.round((wordCount / wpm) * 60);
}

export function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
