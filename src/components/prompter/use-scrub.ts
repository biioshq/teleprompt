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
    if (pending.current === 0) return;
    pending.current = 0;

    /**
     * Send where we ended up, not how far the finger travelled.
     *
     * `scrub` is a delta measured in viewport heights, so the same gesture
     * moved the display by a fraction of *its* window rather than the same
     * words - a different number of lines, and a different answer again if the
     * display was resized or full-screened. Because the gesture already
     * applied locally, this device knows the exact anchor it landed on, and an
     * anchor means the same thing on every screen. Every other position in the
     * app travels this way; this was the one path leaking pixels across.
     */
    dispatch({ k: "seek", anchor: engine.getAnchor() });
  }, [dispatch, engine]);

  /**
   * Call once when a gesture starts. A follower takes local authority for the
   * duration, both so the text tracks the finger and so the anchor it reports
   * back is its own considered position rather than a guess.
   */
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

      // The local nudge is what makes the resulting anchor meaningful, so it
      // has to happen before the flush reads it.
      engine.nudgePixels(pixels);
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
