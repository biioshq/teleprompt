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

import { type DistributiveOmit } from "~/lib/types";

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
