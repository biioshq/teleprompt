/**
 * Turning written words and heard words into the same tokens.
 *
 * A script is written for the eye and a transcript comes back from an ear, and
 * they disagree constantly about things that do not matter: capitals, commas,
 * curly apostrophes, whether "20%" is one word or three. Matching them raw
 * fails on almost every line, so both sides are pushed through this file first
 * and compared as plain lowercase tokens.
 *
 * Everything here is a pure function of its input. The script side is
 * tokenised once when a room opens and the spoken side on every recognition
 * event, and the two must agree exactly, so there is no locale or environment
 * input anywhere in this module.
 */

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

/**
 * Small numbers only, and deliberately so.
 *
 * "5 minutes" is read as "five minutes" every time, so expanding it is a clear
 * win. "2026" is read as "twenty twenty six" by a person and written as
 * "two thousand and twenty six" by any expander worth having, so expanding it
 * would swap one mismatch for a longer one. Above a hundred the recogniser
 * tends to return digits anyway, which match the script as written.
 */
function numberWords(value: number): string[] {
  if (value < 20) return [ONES[value]!];
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)]!;
    const unit = value % 10;
    return unit === 0 ? [tens] : [tens, ONES[unit]!];
  }
  return ["one", "hundred"];
}

/**
 * Symbols a reader says out loud. Spaced rather than deleted, because "20%"
 * has to become two tokens and not one run-on.
 */
const SPOKEN_SYMBOLS: Array<[RegExp, string]> = [
  [/%/g, " percent "],
  [/&/g, " and "],
  [/\$/g, " dollars "],
  [/€/g, " euros "],
  [/£/g, " pounds "],
  [/₹/g, " rupees "],
  [/\+/g, " plus "],
  [/=/g, " equals "],
  [/@/g, " at "],
];

/**
 * Combining diacritics, U+0300–U+036F.
 *
 * Only this block is stripped. It covers the Latin, Greek and Cyrillic accents
 * a recogniser routinely drops or adds, and it leaves Devanagari matras, Thai
 * vowel signs and Arabic harakat alone; those are not decoration, and folding
 * them away would make a script in those languages unmatchable.
 */
const LATIN_DIACRITICS = /[\u0300-\u036f]/g;

/**
 * One written word to the tokens a person would say for it.
 *
 * Returns an array because a single written word is not always a single spoken
 * one: "20%" is "twenty percent" and "and/or" is "and or".
 */
export function expandWord(input: string): string[] {
  const folded = input
    .normalize("NFD")
    .replace(LATIN_DIACRITICS, "")
    .normalize("NFC")
    .toLowerCase();

  let text = folded;
  for (const [pattern, replacement] of SPOKEN_SYMBOLS) {
    text = text.replace(pattern, replacement);
  }

  // Apostrophes close up rather than split, so "don't" and "dont" agree; a
  // recogniser will happily return either.
  text = text.replace(/['‘’ʼ]/g, "");
  // Everything else that is not a letter, a digit or a space is a separator.
  text = text.replace(/[^\p{L}\p{N}\s]/gu, " ");

  const out: string[] = [];
  for (const part of text.split(/\s+/)) {
    if (!part) continue;
    if (/^\d+$/.test(part)) {
      const value = Number(part);
      if (value <= 100) {
        out.push(...numberWords(value));
        continue;
      }
    }
    out.push(part);
  }
  return out;
}

/** A whole heard phrase to tokens. */
export function expandPhrase(input: string): string[] {
  const out: string[] = [];
  for (const word of input.split(/\s+/)) {
    if (word) out.push(...expandWord(word));
  }
  return out;
}

/**
 * A script token, and which rendered word on screen it came from.
 *
 * These are not one to one: "20%" is one word on the display and two tokens
 * here. The `word` index is what the prompter needs in order to light up the
 * text, so it is carried along rather than recomputed.
 */
export type ScriptToken = { text: string; word: number };

/** Tokenise the script's rendered words, keeping the link back to each one. */
export function buildScriptTokens(words: string[]): ScriptToken[] {
  const tokens: ScriptToken[] = [];
  words.forEach((word, index) => {
    for (const text of expandWord(word)) tokens.push({ text, word: index });
  });
  return tokens;
}
