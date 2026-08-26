/**
 * A rehype plugin that wraps every rendered word in its own element.
 *
 * Voice tracking needs two things the block list cannot give it: the exact
 * words as the reader sees them, and where each one physically sits on screen.
 * Counting words from the Markdown source would give neither: link syntax,
 * emphasis markers and entities all mean the source and the rendered line
 * disagree about what a word is, and disagreeing by one is enough to light up
 * the wrong part of the sentence.
 *
 * Wrapping at render time makes the two agree by construction: the word list
 * *is* the DOM, so `data-tp-word` elements in document order are exactly the
 * words in reading order, and each one can be measured.
 *
 * Applied on every render of a room's script rather than only while the
 * microphone is live. A long script is thousands of extra nodes, but arming
 * the microphone mid-take would otherwise rebuild the whole canvas, and a
 * device that is not listening still marks spoken words from the position it
 * is following.
 */

// `import type` rather than the inline-type form used elsewhere: `hast` is a
// types-only package with nothing to import at runtime, and under
// `verbatimModuleSyntax` the inline form would leave a real import behind and
// fail to resolve in the browser.
import type { ElementContent, Root } from "hast";

/** Never spoken, so never marked: code is not read out and tags are not text. */
const SKIP_TAGS = new Set(["code", "pre", "script", "style"]);

const HAS_CONTENT = /[\p{L}\p{N}]/u;

type Parent = { children: ElementContent[] };

function splitText(value: string): ElementContent[] {
  // Keeping the separators means whitespace survives intact, which matters:
  // dropping it would silently reflow every line of the script.
  const parts = value.split(/(\s+)/);
  const out: ElementContent[] = [];

  for (const part of parts) {
    if (!part) continue;
    if (!HAS_CONTENT.test(part)) {
      out.push({ type: "text", value: part });
      continue;
    }
    out.push({
      type: "element",
      tagName: "span",
      properties: { dataTpWord: "1" },
      children: [{ type: "text", value: part }],
    });
  }

  return out;
}

function walk(node: Parent) {
  const next: ElementContent[] = [];
  let changed = false;

  for (const child of node.children) {
    if (child.type === "text") {
      const pieces = splitText(child.value);
      if (pieces.length === 1 && pieces[0]?.type === "text") {
        next.push(child);
      } else {
        changed = true;
        next.push(...pieces);
      }
      continue;
    }
    if (child.type === "element" && !SKIP_TAGS.has(child.tagName)) {
      walk(child);
    }
    next.push(child);
  }

  if (changed) node.children = next;
}

export function rehypeWordSpans() {
  return (tree: Root) => {
    // Markdown never produces a doctype node, so every child of the root is
    // also valid element content.
    walk(tree as unknown as Parent);
  };
}
