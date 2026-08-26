"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { type Block } from "~/lib/markdown/blocks";
import { rehypeWordSpans } from "~/lib/voice/word-spans";
import { cn } from "~/lib/utils";

/**
 * How a script block looks, wherever it is shown.
 *
 * Extracted from the canvas so the editor's preview can render through the
 * same code rather than through plain Markdown. A cue is Teleprompt's own
 * addition to the syntax, and plain Markdown has no idea what `::` means; it
 * showed the line as an ordinary paragraph, so the preview disagreed with the
 * prompter about the one piece of syntax the product invented. Sharing the
 * renderer is the only way to keep them honest: there is now no second
 * implementation to drift.
 */

/** Inline formatting only: bold, italics, code. Links are never clickable. */
const INLINE_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  a: ({ children }: { children?: React.ReactNode }) => (
    <span className="underline decoration-current/40 underline-offset-[0.2em]">
      {children}
    </span>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <span className="font-mono text-[0.9em] opacity-90">{children}</span>
  ),
};

/**
 * Only built when voice tracking needs it. A long script is several thousand
 * extra elements, and nothing else in the app has any use for them.
 */
const WORD_PLUGINS = [rehypeWordSpans];

function Inline({ source, words }: { source: string; words?: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={words ? WORD_PLUGINS : undefined}
      components={INLINE_COMPONENTS}
      disallowedElements={["img", "h1", "h2", "h3", "h4", "h5", "h6"]}
      unwrapDisallowed
    >
      {source}
    </ReactMarkdown>
  );
}

const HEADING_SIZE: Record<number, string> = {
  1: "text-[1.32em] font-semibold",
  2: "text-[1.18em] font-semibold",
  3: "text-[1.06em] font-semibold",
  4: "text-[1em] font-semibold",
  5: "text-[1em] font-semibold",
  6: "text-[1em] font-semibold",
};

export const BlockView = memo(function BlockView({
  block,
  interactive = false,
  words = false,
  dimmed = true,
}: {
  block: Block;
  interactive?: boolean;
  /**
   * Wrap each word in its own element, so voice tracking can find it and light
   * it up.
   *
   * Deliberately not applied to cues or code. Neither is ever read aloud, and
   * the word list has to be exactly the spoken script: a cue counted as words
   * would put every mark after it one line out.
   */
  words?: boolean;
  /**
   * Whether blocks away from the reading line recede.
   *
   * True on a prompter, where exactly one line is being read and the rest
   * should get out of the way. False in the editor's preview, which has no
   * reading line; everything there is equally "now", and dimming all of it
   * would just make the whole pane grey.
   */
  dimmed?: boolean;
}) {
  const common = cn(
    "relative px-[0.1em] py-[0.32em] transition-opacity duration-300",
    // Anything not on the reading line recedes; the active block comes back to
    // full strength. Driven by the engine, not by React.
    dimmed && "opacity-45 data-[tp-active]:opacity-100",
    interactive && "cursor-pointer",
  );

  const body = (() => {
    switch (block.kind) {
      case "heading":
        return (
          <div
            className={cn(
              HEADING_SIZE[block.level],
              "tracking-[-0.02em]",
              block.level <= 2 && "mt-[0.5em]",
            )}
          >
            <Inline source={block.source} words={words} />
          </div>
        );

      case "list-item":
        return (
          <div
            className="flex gap-[0.5em]"
            style={{ paddingLeft: `${block.depth * 1.1}em` }}
          >
            <span
              aria-hidden
              className="shrink-0 font-mono text-[0.62em] opacity-60"
              style={{ paddingTop: "0.5em" }}
            >
              {block.ordered ? block.marker : "—"}
            </span>
            <span className="flex-1">
              <Inline source={block.source} words={words} />
            </span>
          </div>
        );

      case "quote":
        return (
          <div className="border-l-[3px] border-current/25 pl-[0.6em] italic">
            <Inline source={block.source} words={words} />
          </div>
        );

      case "cue":
        return (
          <div className="flex items-baseline gap-[0.5em] py-[0.15em]">
            <span
              aria-hidden
              className="shrink-0 font-mono text-[0.5em] tracking-[0.2em] uppercase"
              style={{ color: "var(--tp-rule)" }}
            >
              cue
            </span>
            <span
              className="font-mono text-[0.58em] tracking-[0.02em] uppercase"
              style={{ color: "var(--tp-rule)" }}
            >
              {block.source}
            </span>
          </div>
        );

      case "rule":
        return (
          <div className="flex items-center gap-[0.5em] py-[0.5em]" aria-hidden>
            <span className="h-px flex-1 bg-current opacity-25" />
            <span className="font-mono text-[0.45em] tracking-[0.3em] uppercase opacity-45">
              break
            </span>
            <span className="h-px flex-1 bg-current opacity-25" />
          </div>
        );

      case "code":
        return (
          <pre className="overflow-x-auto rounded-[0.1em] bg-current/8 px-[0.5em] py-[0.4em] font-mono text-[0.62em] leading-relaxed">
            <code>{block.source}</code>
          </pre>
        );

      case "table":
        return (
          <div className="overflow-x-auto text-[0.62em]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={words ? WORD_PLUGINS : undefined}
            >
              {block.source}
            </ReactMarkdown>
          </div>
        );

      default:
        return <Inline source={block.source} words={words} />;
    }
  })();

  return (
    <div
      data-tp-block={block.index}
      data-tp-kind={block.kind}
      className={common}
    >
      {body}
    </div>
  );
});
