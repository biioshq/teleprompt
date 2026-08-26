/**
 * Finding the spoken words in the written script.
 *
 * The naive version of this (remember the last matched word, compare the next
 * heard word to the next written one) falls apart on the first line of real
 * use. People skip words, add words, say "and" where the page says "&", and
 * the recogniser mishears roughly one word in ten. Any of those desynchronises
 * a pointer permanently.
 *
 * So the last few heard words are matched against a *window* of the script by
 * local alignment (Smith–Waterman), which is allowed to insert, drop and
 * substitute freely and reports how good the best fit was. Two or three solid
 * word matches inside that window are enough to place the reader precisely,
 * and everything else in the phrase can be wrong without costing anything.
 *
 * The window is the other half of the idea. A script says "thank you" six
 * times, so a search over the whole document would teleport the reader to the
 * wrong one. Searching a couple of sentences either side of where they already
 * were makes a repeated phrase unambiguous.
 */

import { expandPhrase, type ScriptToken } from "~/lib/voice/normalise";

/* -------------------------------------------------------------------------- */
/* Word similarity                                                            */
/* -------------------------------------------------------------------------- */

const MATCH = 2;
const NEAR = 1;
const MISMATCH = -1.5;
/** Cost of a word in the script that was not heard: a skip, or a dropped word. */
const GAP_SCRIPT = -1;
/** Cost of a heard word that is not in the script: an ad-lib, or noise. */
const GAP_SPOKEN = -1;

/**
 * Edit distance, abandoned as soon as it exceeds `limit`.
 *
 * The bound is what makes this affordable: it runs a few thousand times per
 * recognition event, and almost every pair is obviously unrelated and exits on
 * the first row.
 */
function withinDistance(a: string, b: string, limit: number): boolean {
  if (Math.abs(a.length - b.length) > limit) return false;
  if (a === b) return true;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (previous[j] ?? Infinity) + 1,
        (current[j - 1] ?? Infinity) + 1,
        (previous[j - 1] ?? Infinity) + substitution,
      );
      current[j] = value;
      if (value < best) best = value;
    }
    if (best > limit) return false;
    const swap = previous;
    previous = current;
    current = swap;
  }

  return (previous[b.length] ?? Infinity) <= limit;
}

/**
 * How much a heard word and a written word are worth to each other.
 *
 * The near-match tier is doing most of the work in practice. It is what makes
 * "recognise" match "recognises", "colour" match "color" and the recogniser's
 * confident nonsense match the word it was reaching for.
 */
export function wordScore(spoken: string, script: string): number {
  if (spoken === script) return MATCH;

  const shorter = Math.min(spoken.length, script.length);
  if (shorter < 4) return MISMATCH;

  // A shared stem: plurals, tenses, possessives.
  if (spoken.startsWith(script) || script.startsWith(spoken)) return NEAR;

  if (withinDistance(spoken, script, 1)) return NEAR;
  if (shorter >= 7 && withinDistance(spoken, script, 2)) return NEAR;

  return MISMATCH;
}

/* -------------------------------------------------------------------------- */
/* Local alignment                                                            */
/* -------------------------------------------------------------------------- */

export type Alignment = {
  /** Index into `script` of the last token the phrase reached, inclusive. */
  end: number;
  score: number;
};

/**
 * Best local alignment of `spoken` against `script[from, to)`.
 *
 * Only the score row is kept: the alignment path itself is never needed, just
 * where it ended, which is the reader's position.
 *
 * Selection is nudged toward alignments that consume more of the phrase. Two
 * fits can score the same while one explains the first half of what was said
 * and the other the second half, and the second is always the current one: the
 * words that just came out of the speaker's mouth are the words they are on.
 */
export function alignPhrase(
  spoken: string[],
  script: ScriptToken[],
  from: number,
  to: number,
): Alignment | null {
  const width = to - from;
  if (width <= 0 || spoken.length === 0) return null;

  let previous = new Array<number>(width + 1).fill(0);
  let current = new Array<number>(width + 1).fill(0);

  let bestScore = 0;
  let bestEnd = -1;
  let bestRank = -Infinity;

  for (let row = 1; row <= spoken.length; row += 1) {
    const heard = spoken[row - 1]!;
    current[0] = 0;
    // Later words in the phrase are the more recent ones; a tie between two
    // equally good fits should go to whichever explains them.
    const recency = 0.08 * row;

    for (let column = 1; column <= width; column += 1) {
      const written = script[from + column - 1]!.text;
      const diagonal = (previous[column - 1] ?? 0) + wordScore(heard, written);
      const value = Math.max(
        0,
        diagonal,
        (previous[column] ?? 0) + GAP_SPOKEN,
        (current[column - 1] ?? 0) + GAP_SCRIPT,
      );
      current[column] = value;

      const rank = value + recency;
      if (value > 0 && rank > bestRank) {
        bestRank = rank;
        bestScore = value;
        bestEnd = from + column - 1;
      }
    }

    const swap = previous;
    previous = current;
    current = swap;
  }

  if (bestEnd < 0) return null;
  return { end: bestEnd, score: bestScore };
}

/* -------------------------------------------------------------------------- */
/* The tracker                                                                */
/* -------------------------------------------------------------------------- */

/** Heard words kept as context, across utterance boundaries. */
const HISTORY = 60;
/** How many of them are matched. Longer is steadier; shorter is quicker. */
const PHRASE = 12;
/** Tokens behind the cursor the window reaches, enough to restart a sentence. */
const LOOK_BEHIND = 16;
/** Tokens ahead. A skipped sentence is recoverable; a skipped page is not. */
const LOOK_AHEAD = 80;

/** Roughly two clean word matches. Below this, the phrase explains nothing. */
const MIN_SCORE = 4;
/** Moving backwards is nearly always noise, so it has to be argued for. */
const MIN_SCORE_BACK = 7;
/**
 * A jump to anywhere in the script needs to be near-certain, because the cost
 * of getting it wrong is the reader's page changing under them.
 */
const MIN_SCORE_GLOBAL = 11;
/** Silence long enough to mean they are somewhere else entirely. */
const LOST_AFTER_MS = 4000;

export type TrackerUpdate = {
  /** Index into the script tokens, exclusive: everything before it was said. */
  cursor: number;
  /** How many rendered words that is: what the display lights up. */
  spokenWords: number;
  moved: boolean;
  /** True when the last phrase could not be placed at all. */
  searching: boolean;
};

/**
 * Holds the reader's place across recognition events.
 *
 * The recogniser reports a growing interim guess and then a final version of
 * the same utterance, so the same words arrive several times. Everything here
 * is idempotent: feeding the same phrase twice lands on the same cursor.
 */
export class VoiceTracker {
  private readonly script: ScriptToken[];
  private readonly wordCount: number;

  /** Tokens from finalised results, oldest first. */
  private committed: string[] = [];
  /** Tokens from the result still being spoken. */
  private interim: string[] = [];

  private cursor = 0;
  private lastMatchAt = 0;

  constructor(script: ScriptToken[], wordCount: number) {
    this.script = script;
    this.wordCount = wordCount;
  }

  /** Place the reader by hand. Used when someone scrubs or taps a line. */
  reset(word: number, now: number) {
    const clamped = Math.min(Math.max(0, word), this.wordCount);
    this.cursor = this.tokenForWord(clamped);
    this.committed = [];
    this.interim = [];
    this.lastMatchAt = now;
  }

  /** The first token belonging to a rendered word. The two are not one to one. */
  private tokenForWord(word: number): number {
    if (word >= this.wordCount) return this.script.length;
    let low = 0;
    let high = this.script.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((this.script[mid]?.word ?? 0) < word) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  private get spokenWords(): number {
    if (this.cursor <= 0) return 0;
    if (this.cursor >= this.script.length) return this.wordCount;
    // The cursor sits on the next token to be said; a word only counts as
    // spoken once the cursor has left it, otherwise a multi-token word would
    // light up halfway through.
    return this.script[this.cursor]!.word;
  }

  pushFinal(text: string) {
    const tokens = expandPhrase(text);
    if (tokens.length === 0) return;
    this.committed = this.committed.concat(tokens).slice(-HISTORY);
    this.interim = [];
  }

  setInterim(text: string) {
    this.interim = expandPhrase(text).slice(-HISTORY);
  }

  /** Re-place the reader from everything heard so far. */
  advance(now: number): TrackerUpdate {
    const phrase = this.committed.concat(this.interim).slice(-PHRASE);
    const unchanged = {
      cursor: this.cursor,
      spokenWords: this.spokenWords,
      moved: false,
      searching: now - this.lastMatchAt > LOST_AFTER_MS,
    };

    // One word is not evidence. Nearly every script contains nearly every
    // common word, and a single token would place the reader at random.
    if (phrase.length < 2 || this.script.length === 0) return unchanged;

    const lost = now - this.lastMatchAt > LOST_AFTER_MS;
    const from = lost ? 0 : Math.max(0, this.cursor - LOOK_BEHIND);
    const to = lost
      ? this.script.length
      : Math.min(this.script.length, this.cursor + LOOK_AHEAD);

    const best = alignPhrase(phrase, this.script, from, to);
    if (!best) return unchanged;

    const next = best.end + 1;
    const floor = lost
      ? MIN_SCORE_GLOBAL
      : next < this.cursor
        ? MIN_SCORE_BACK
        : MIN_SCORE;
    if (best.score < floor) return unchanged;

    // A phrase that lands exactly where the reader already is is still a
    // match: it is what keeps a slow speaker from being declared lost.
    this.lastMatchAt = now;
    if (next === this.cursor) return { ...unchanged, searching: false };

    this.cursor = next;
    return {
      cursor: this.cursor,
      spokenWords: this.spokenWords,
      moved: true,
      searching: false,
    };
  }
}
