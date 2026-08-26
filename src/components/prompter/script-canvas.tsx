"use client";

import { useMemo } from "react";

import { BlockView } from "~/components/prompter/script-blocks";
import { splitIntoBlocks } from "~/lib/markdown/blocks";
import { THEME_TOKENS, type PrompterState } from "~/lib/prompter/state";
import { cn } from "~/lib/utils";

/**
 * Renders a script as a flat list of blocks.
 *
 * The list is memoised on the source text alone. Once it is mounted, scrolling
 * never re-renders it; the engine translates the wrapper and writes the active
 * block's attribute directly. Type size and width are applied as inline styles
 * on the wrapper so a settings change reflows the text without rebuilding it.
 */

export type ScriptCanvasProps = {
  content: string;
  state: PrompterState;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** Only affects the cursor; the container resolves which block was hit. */
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
          className="absolute inset-x-0 top-0 mx-auto pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] will-change-transform"
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
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-3 gutter-sm"
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
