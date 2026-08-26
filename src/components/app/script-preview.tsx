"use client";

import { useMemo } from "react";

import { BlockView } from "~/components/prompter/script-blocks";
import { splitIntoBlocks } from "~/lib/markdown/blocks";
import { THEME_TOKENS } from "~/lib/prompter/state";
import { cn } from "~/lib/utils";

/**
 * The editor's preview, rendered by the prompter's own block renderer.
 *
 * The point of a preview is to answer "what will this look like", and the
 * editor's built-in one could not: it renders plain Markdown, and cues are not
 * Markdown. A line beginning with `::` came out as an ordinary paragraph, so
 * the one piece of syntax this product invented was the one piece the preview
 * got wrong, and the words you are never going to say looked exactly like the
 * words you are.
 *
 * Rendering it a second, more faithful way would only move the disagreement.
 * This runs the same splitter and the same block components the display does,
 * on the same reading surface, so the two agree by construction rather than by
 * anybody remembering to keep them in step.
 *
 * What is deliberately not reproduced is the motion: no reading line, no
 * scrolling, nothing dimmed. Those belong to a take, not to a page you are
 * reading over while you write.
 */
export function ScriptPreview({
  value,
  height,
  className,
}: {
  value: string;
  height?: number;
  className?: string;
}) {
  const blocks = useMemo(() => splitIntoBlocks(value), [value]);
  const theme = THEME_TOKENS.night;

  return (
    <div
      className={cn("h-full overflow-y-auto overscroll-contain", className)}
      style={
        {
          // Only used when the preview stands alone. Inside the editor the
          // pane sizes it, and `h-full` is what fills it.
          minHeight: height,
          backgroundColor: theme.bg,
          color: theme.fg,
          "--tp-rule": theme.rule,
          "--tp-dim": theme.dim,
        } as React.CSSProperties
      }
    >
      <div
        // The type is smaller than a real display's (this is a page being
        // read at desk distance, not a lens away), but everything is sized in
        // `em`, so the proportions between a heading, a cue and a line of
        // script are the ones that will be on the screen.
        className="mx-auto max-w-[42rem] px-6 py-8"
        style={{
          fontSize: "1.125rem",
          lineHeight: 1.5,
          fontWeight: 500,
          letterSpacing: "-0.012em",
        }}
      >
        {blocks.length === 0 ? (
          <p className="text-[0.8125rem]" style={{ color: theme.dim }}>
            Nothing to preview yet.
          </p>
        ) : (
          blocks.map((block) => (
            <BlockView key={block.index} block={block} dimmed={false} />
          ))
        )}
      </div>
    </div>
  );
}
