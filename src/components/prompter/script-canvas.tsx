"use client";

import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { splitIntoBlocks, type Block } from "~/lib/markdown/blocks";
import { THEME_TOKENS, type PrompterState } from "~/lib/prompter/state";
import { rehypeWordSpans } from "~/lib/voice/word-spans";
import { cn } from "~/lib/utils";

/**
 * Renders a script as a flat list of blocks.
 *
 * The list is memoised on the source text alone. Once it is mounted, scrolling
 * never re-renders it — the engine translates the wrapper and writes the active
 * block's attribute directly. Type size and width are applied as inline styles
 * on the wrapper so a settings change reflows the text without rebuilding it.
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

const BlockView = memo(function BlockView({
  block,
  interactive = false,
  words = false,
}: {
  block: Block;
  interactive?: boolean;
  /**
   * Wrap each word in its own element, so voice tracking can find it and light
   * it up.
   *
   * Deliberately not applied to cues or code. Neither is ever read aloud, and
   * the word list has to be exactly the spoken script — a cue counted as words
   * would put every mark after it one line out.
   */
  words?: boolean;
}) {
  const common = cn(
    "relative px-[0.1em] py-[0.32em] transition-opacity duration-300",
    // Anything not on the reading line recedes; the active block comes back to
    // full strength. Driven by the engine, not by React.
    "opacity-45 data-[tp-active]:opacity-100",
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

export type ScriptCanvasProps = {
  content: string;
  state: PrompterState;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** Only affects the cursor — the container resolves which block was hit. */
  interactive?: boolean;
  /** Render one element per word, for voice tracking. */
  words?: boolean;
  className?: string;
  /** Shows the reading-line rule and the edge fades. */
  chrome?: boolean;
};

export function ScriptCanvas({
  content,
  state,
  viewportRef,
  contentRef,
  interactive = false,
  words = false,
  className,
  chrome = true,
}: ScriptCanvasProps) {
  const blocks = useMemo(() => splitIntoBlocks(content), [content]);
  const theme = THEME_TOKENS[state.theme];

  const flip = [
    state.flipHorizontal ? "scaleX(-1)" : "",
    state.flipVertical ? "scaleY(-1)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={viewportRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={
        {
          backgroundColor: theme.bg,
          color: theme.fg,
          "--tp-rule": theme.rule,
          "--tp-dim": theme.dim,
        } as React.CSSProperties
      }
    >
      <div
        className={cn("absolute inset-0", chrome && "stage-fade")}
        style={{ transform: flip || undefined }}
      >
        <div
          ref={contentRef}
          // Centred with auto margins, never with a translate: the engine owns
          // this element's `transform` outright and would overwrite one.
          className="absolute inset-x-0 top-0 mx-auto will-change-transform"
          style={{
            maxWidth: `${state.contentWidth}%`,
            fontSize: `${state.fontSize}px`,
            lineHeight: state.lineHeight,
            fontWeight: 500,
            letterSpacing: "-0.012em",
          }}
        >
          {/* The engine sets padding-top / padding-bottom on this element so
              the first and last blocks can both reach the reading line. */}
          {blocks.map((block) => (
            <BlockView
              key={block.index}
              block={block}
              interactive={interactive}
              words={words && block.words > 0}
            />
          ))}
        </div>
      </div>

      {chrome && state.showReadingLine ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-3 px-4"
          style={{ top: `${state.readingLine * 100}%` }}
        >
          <span
            className="h-0 w-0 border-y-[7px] border-l-[10px] border-y-transparent"
            style={{ borderLeftColor: theme.rule }}
          />
          <span
            className="h-px flex-1 opacity-30"
            style={{ backgroundColor: theme.rule }}
          />
          <span
            className="h-0 w-0 border-y-[7px] border-r-[10px] border-y-transparent"
            style={{ borderRightColor: theme.rule }}
          />
        </div>
      ) : null}
    </div>
  );
}
