"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import { scriptWordCount } from "~/lib/markdown/blocks";
import { type Anchor, type PrompterState } from "~/lib/prompter/state";
import { PrompterEngine, type EngineMode } from "~/components/prompter/engine";

/**
 * Binds a `PrompterEngine` to a `ScriptCanvas`.
 *
 * Everything that changes the shape of the text — the script itself, type size,
 * line height, column width, the position of the reading line, a rotation, a
 * web font finally arriving — has to trigger a re-measure, and every re-measure
 * keeps the reader on the same words.
 */
export function useEngine({
  content,
  state,
  mode,
  highlight = false,
  initialAnchor,
}: {
  content: string;
  state: PrompterState;
  mode: EngineMode;
  highlight?: boolean;
  /**
   * Where the room was when it was last written to the database. Applied once,
   * after the first measure. Without this the position was persisted every few
   * seconds and then never read back, so every session opened at the top of
   * the script no matter where it had been left.
   */
  initialAnchor?: Anchor;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<PrompterEngine | null>(null);
  engineRef.current ??= new PrompterEngine();
  const engine = engineRef.current;

  // Set before the first measure so the very first frame is already paced.
  const totalWordsRef = useRef(0);
  totalWordsRef.current = scriptWordCount(content);

  // Captured once: restoring is a mount-time action, not something that should
  // yank the reader every time the prop identity changes.
  const initialAnchorRef = useRef(initialAnchor);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const contentEl = contentRef.current;
    if (!viewport || !contentEl) return;

    engine.setSettings({
      speedWpm: state.speedWpm,
      readingLine: state.readingLine,
      totalWords: totalWordsRef.current,
    });
    engine.attach(viewport, contentEl);

    const anchor = initialAnchorRef.current;
    if (anchor && (anchor.blockIndex > 0 || anchor.blockFraction > 0)) {
      // Safe before web fonts settle: a later re-measure preserves the anchor
      // rather than the pixel offset.
      engine.seek(anchor);
    }

    return () => engine.destroy();
    // Attach once. Everything else is pushed in through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pace and reading line.
  useEffect(() => {
    engine.setSettings({
      speedWpm: state.speedWpm,
      readingLine: state.readingLine,
      totalWords: scriptWordCount(content),
    });
  }, [engine, state.speedWpm, state.readingLine, content]);

  useEffect(() => {
    engine.setMode(mode);
  }, [engine, mode]);

  useEffect(() => {
    engine.setHighlight(highlight);
  }, [engine, highlight]);

  // Anything that reflows the text.
  useLayoutEffect(() => {
    engine.measure();
  }, [
    engine,
    content,
    state.fontSize,
    state.lineHeight,
    state.contentWidth,
    state.readingLine,
  ]);

  // Web fonts land after first paint and change every line box.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) engine.measure();
    });
    return () => {
      cancelled = true;
    };
  }, [engine]);

  // Rotation, window resize, the iOS URL bar collapsing, a panel opening.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => engine.measure());
    });
    observer.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [engine]);

  return { engine, viewportRef, contentRef };
}
