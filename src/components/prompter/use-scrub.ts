"use client";

import { useCallback, useEffect, useRef } from "react";

import { type PrompterEngine } from "~/components/prompter/engine";
import { type Command } from "~/lib/realtime/protocol";

const FLUSH_INTERVAL_MS = 40;

/**
 * Scrubbing by hand produces pointer events at display refresh rate. Sending a
 * command per event would push 60 messages a second at the relay, and the
 * driver echoes a state broadcast for each one — so deltas are accumulated and
 * flushed on a fixed interval instead. 40ms keeps both directions comfortably
 * inside the channel's rate limit while still feeling continuous.
 *
 * A device that is not driving also applies the delta to its own engine
 * immediately and only afterwards tells the driver. Waiting for the round trip
 * before the text under your finger moves feels broken, even at 30ms.
 */
export function useScrub({
  engine,
  driving,
  dispatch,
  viewportRef,
}: {
  engine: PrompterEngine;
  driving: boolean;
  dispatch: (command: Command) => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const pending = useRef(0);
  const timer = useRef<number | null>(null);
  const optimistic = useRef(false);

  const flush = useCallback(() => {
    timer.current = null;
    const pixels = pending.current;
    pending.current = 0;
    if (pixels === 0) return;
    const height = viewportRef.current?.clientHeight ?? 1;
    dispatch({ k: "scrub", delta: pixels / height });
  }, [dispatch, viewportRef]);

  /** Call once when a gesture starts, so a follower can move under the finger. */
  const beginGesture = useCallback(() => {
    if (driving) return;
    optimistic.current = true;
    engine.setMode("drive");
  }, [driving, engine]);

  const endGesture = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      // The tail of a flick matters — never drop the last few pixels.
      flush();
    }
    if (!optimistic.current) return;
    optimistic.current = false;
    // Hand authority back; the next snapshot from the driver takes over.
    engine.setMode("follow");
  }, [engine, flush]);

  const scrubPixels = useCallback(
    (pixels: number) => {
      if (pixels === 0) return;

      if (driving) {
        engine.nudgePixels(pixels);
        return;
      }

      if (optimistic.current) engine.nudgePixels(pixels);
      pending.current += pixels;
      timer.current ??= window.setTimeout(flush, FLUSH_INTERVAL_MS);
    },
    [driving, engine, flush],
  );

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return { scrubPixels, beginGesture, endGesture };
}
