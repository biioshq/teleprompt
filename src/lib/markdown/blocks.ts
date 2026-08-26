/**
 * Deterministic markdown -> block splitter.
 *
 * The prompter and the remote must agree on block boundaries exactly, because
 * block indices are the coordinate system the two devices sync in. So this is a
 * pure function of the source string with no environment input at all: same
 * text in, same blocks out, on every device.
 *
 * It is deliberately not a full markdown parser. Inline formatting is left to
 * `react-markdown` at render time; this pass only decides where one readable
 * chunk ends and the next begins.
 */

import type { DistributiveOmit } from "~/lib/types";

export type Block =
  | {
      kind: "heading";
      index: number;
      level: 1 | 2 | 3 | 4 | 5 | 6;
      source: string;
      words: number;
    }
  | { kind: "paragraph"; index: number; source: string; words: number }
  | {
      kind: "list-item";
      index: number;
      ordered: boolean;
      marker: string;
      depth: number;
      source: string;
      words: number;
    }
  | { kind: "quote"; index: number; source: string; words: number }
  | {
      kind: "code";
      index: number;
      language: string | null;
      source: string;
      words: number;
    }
  | { kind: "table"; index: number; source: string; words: number }
  | { kind: "rule"; index: number; source: string; words: number }
  /** `:: look at camera` — a director's note. Never read aloud. */
  | { kind: "cue"; index: number; source: string; words: number };

export type BlockKind = Block["kind"];

/** A block before the splitter assigns it its position in the list. */
type UnindexedBlock = DistributiveOmit<Block, "index">;

const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const UNORDERED_ITEM = /^(\s*)([-*+])\s+(.*)$/;
const ORDERED_ITEM = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const CUE = /^\s{0,3}::\s?(.*)$/;
const TABLE_ROW = /^\s{0,3}\|.*\|\s*$/;

/** Strip enough markdown to make a word count that matches spoken words. */
export function countWords(input: string): number {
  const text = input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~#>|]/g, " ")
    .replace(/^\s*\d+[.)]\s+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(" ").filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function splitIntoBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  let index = 0;
  const push = (block: UnindexedBlock) => {
    blocks.push({ ...block, index: index++ } as Block);
  };

  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor] ?? "";

    // Blank lines are separators, never content.
    if (!line.trim()) {
      cursor += 1;
      continue;
    }

    // Fenced code — consumed whole so an internal `---` is not read as a rule.
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1] ?? "```";
      const language = fence[2] ? fence[2] : null;
      const body: string[] = [];
      cursor += 1;
      while (cursor < lines.length) {
        const current = lines[cursor] ?? "";
        if (current.trimStart().startsWith(marker)) {
          cursor += 1;
          break;
        }
        body.push(current);
        cursor += 1;
      }
      push({
        kind: "code",
        language,
        source: body.join("\n"),
        words: 0,
      });
      continue;
    }

    // Director's cue.
    const cue = CUE.exec(line);
    if (cue) {
      push({ kind: "cue", source: (cue[1] ?? "").trim(), words: 0 });
      cursor += 1;
      continue;
    }

    // Section break / beat.
    if (RULE.test(line)) {
      push({ kind: "rule", source: "", words: 0 });
      cursor += 1;
      continue;
    }

    // Heading.
    const heading = HEADING.exec(line);
    if (heading) {
      const level = Math.min(6, (heading[1] ?? "#").length) as
        1 | 2 | 3 | 4 | 5 | 6;
      const source = (heading[2] ?? "").trim();
      push({ kind: "heading", level, source, words: countWords(source) });
      cursor += 1;
      continue;
    }

    // Blockquote — contiguous `>` lines collapse into one spoken chunk.
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (cursor < lines.length) {
        const current = lines[cursor] ?? "";
        const match = QUOTE.exec(current);
        if (!match) break;
        body.push(match[1] ?? "");
        cursor += 1;
      }
      const source = body.join("\n").trim();
      push({ kind: "quote", source, words: countWords(source) });
      continue;
    }

    // Table — the whole grid is one block; you do not read a table line by line.
    if (TABLE_ROW.test(line)) {
      const body: string[] = [];
      while (cursor < lines.length && TABLE_ROW.test(lines[cursor] ?? "")) {
        body.push(lines[cursor] ?? "");
        cursor += 1;
      }
      const source = body.join("\n");
      push({ kind: "table", source, words: countWords(source) });
      continue;
    }

    // List items — one block each, so a remote can step bullet by bullet.
    const unordered = UNORDERED_ITEM.exec(line);
    const ordered = ORDERED_ITEM.exec(line);
    if (unordered ?? ordered) {
      const indent = (unordered?.[1] ?? ordered?.[1] ?? "").length;
      const marker = unordered?.[2] ?? `${ordered?.[2] ?? "1"}.`;
      const first = unordered?.[3] ?? ordered?.[3] ?? "";
      const body: string[] = [first];
      cursor += 1;
      // Absorb wrapped continuation lines that belong to this item.
      while (cursor < lines.length) {
        const current = lines[cursor] ?? "";
        if (!current.trim()) break;
        if (
          UNORDERED_ITEM.test(current) ||
          ORDERED_ITEM.test(current) ||
          HEADING.test(current) ||
          QUOTE.test(current) ||
          CUE.test(current) ||
          RULE.test(current) ||
          FENCE.test(current)
        ) {
          break;
        }
        body.push(current.trim());
        cursor += 1;
      }
      const source = body.join(" ").trim();
      push({
        kind: "list-item",
        ordered: Boolean(ordered),
        marker,
        depth: Math.min(3, Math.floor(indent / 2)),
        source,
        words: countWords(source),
      });
      continue;
    }

    // Paragraph — contiguous plain lines.
    const body: string[] = [];
    while (cursor < lines.length) {
      const current = lines[cursor] ?? "";
      if (!current.trim()) break;
      if (
        HEADING.test(current) ||
        QUOTE.test(current) ||
        CUE.test(current) ||
        RULE.test(current) ||
        FENCE.test(current) ||
        TABLE_ROW.test(current) ||
        UNORDERED_ITEM.test(current) ||
        ORDERED_ITEM.test(current)
      ) {
        break;
      }
      body.push(current.trim());
      cursor += 1;
    }
    const source = body.join("\n").trim();
    if (source) {
      push({ kind: "paragraph", source, words: countWords(source) });
    }
  }

  return blocks;
}

/** Total spoken words — cues and code are excluded, they are never read out. */
export function spokenWordCount(blocks: Block[]): number {
  return blocks.reduce((total, block) => total + block.words, 0);
}

/** Convenience for the editor and the dashboard. */
export function scriptWordCount(markdown: string): number {
  return spokenWordCount(splitIntoBlocks(markdown));
}

/** First non-empty heading or sentence, used to name an untitled script. */
export function inferTitle(markdown: string, fallback = "Untitled script") {
  for (const block of splitIntoBlocks(markdown)) {
    if (block.kind === "heading" && block.source) {
      return block.source.slice(0, 120);
    }
    if (block.kind === "paragraph" && block.source) {
      const sentence = block.source.split(/(?<=[.!?])\s/)[0] ?? block.source;
      return sentence.replace(/\s+/g, " ").slice(0, 120);
    }
  }
  return fallback;
}

/**
 * The opening of a script as plain prose, for a card with three lines to spend.
 *
 * A card is the one place a script is shown without being rendered, so every
 * mark in it has to be resolved here rather than left to `react-markdown`.
 * What used to do that was a character class — every #, >, *, _, backtick and
 * hyphen swapped for a space — and it was wrong in both directions at once,
 * cutting marks that were not there and leaving the ones that were. It took
 * the hyphen out of
 * "peer-to-peer" and the underscore out of `snake_case`; it left `[text](url)`
 * carrying its brackets and its URL, and a table as a fence of pipes. Worst of
 * all it left cues, because `::` was never in the class: a card could open with
 * a director's note, which is exactly the text nobody is meant to read.
 *
 * So this runs the same splitter the prompter does. The blocks that are never
 * spoken — cues, code, section breaks — are the blocks a summary leaves out,
 * and the two agree by construction rather than by two lists of exceptions
 * that somebody has to remember to keep in step.
 */
export function summarise(markdown: string, limit = 180): string {
  const parts: string[] = [];
  let length = 0;

  for (const block of splitIntoBlocks(opening(markdown, limit))) {
    if (
      block.kind === "cue" ||
      block.kind === "code" ||
      block.kind === "rule"
    ) {
      continue;
    }
    const text = stripInline(
      block.kind === "table" ? flattenTable(block.source) : block.source,
    );
    if (!text) continue;
    parts.push(text);
    // Plus the separator. Enough to fill the card is enough — the rest of a
    // long script is work nobody sees.
    length += text.length + 3;
    if (length >= limit) break;
  }

  // A middot rather than a space: a heading runs straight into the paragraph
  // under it otherwise, and three clamped lines have no room to explain that.
  const summary = parts.join(" · ");
  return summary.length > limit ? `${trimToWord(summary, limit)}…` : summary;
}

/**
 * Enough of the source to fill `limit` readable characters even if most of it
 * turns out to be markup — a script may be hundreds of kilobytes, and a card
 * has no reason to split all of it. Cut on a line so the window never ends
 * mid-word.
 */
function opening(markdown: string, limit: number): string {
  const window = limit * 12;
  if (markdown.length <= window) return markdown;
  const cut = markdown.slice(0, window);
  const lastBreak = cut.lastIndexOf("\n");
  return lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
}

/** The marks a backslash can make literal, per CommonMark. */
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!>~|])/g;

/**
 * Inline marks resolved down to the words somebody would actually say.
 *
 * Escapes are hidden first and put back last. A backslash is how somebody says
 * "this asterisk is an asterisk", so unescaping before the mark rules run would
 * hand them the very asterisks the escape was there to protect, and leaving
 * them in place lets the emphasis rule read \*five\* as emphasis and eat both.
 */
function stripInline(source: string): string {
  const literals: string[] = [];
  const hidden = source.replace(ESCAPED, (_match, char: string) => {
    literals.push(char);
    return `\u0000${literals.length - 1}\u0000`;
  });

  return (
    hidden
      // Images say nothing out loud; a link keeps its text and loses its target.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
      .replace(/<(?:https?:\/\/|mailto:)([^>\s]+)>/g, "$1")
      .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
      .replace(/`+([^`]*)`+/g, "$1")
      .replace(/~~([\s\S]+?)~~/g, "$1")
      .replace(/(\*{1,3})(\S(?:[\s\S]*?\S)?)\1/g, "$2")
      // An underscore only marks emphasis between words. `snake_case` is a word,
      // and the old character class used to spell it "snake case".
      .replace(
        /(^|[^\p{L}\p{N}])(_{1,3})(\S(?:[\s\S]*?\S)?)\2(?=$|[^\p{L}\p{N}])/gu,
        "$1$3",
      )
      .replace(
        /\u0000(\d+)\u0000/g,
        (_match, at: string) => literals[Number(at)] ?? "",
      )
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** A table read out as a line: cells in order, the alignment row dropped. */
function flattenTable(source: string): string {
  return source
    .split("\n")
    .filter((row) => !/^[\s|:-]*-[\s|:-]*$/.test(row))
    .map((row) =>
      row
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join(" · ");
}

/** Cut at the last word that fits, and leave no dangling punctuation behind. */
function trimToWord(text: string, limit: number): string {
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  const kept = space > limit / 2 ? cut.slice(0, space) : cut;
  return kept.replace(/[\s·,;:—–-]+$/, "");
}
