"use client";

import { useEffect, useRef } from "react";

import {
  actionForEvent,
  isEditableTarget,
  type ShortcutAction,
} from "~/lib/keyboard/shortcuts";

/**
 * Binds the shortcut table to a handler.
 *
 * The handler is held in a ref so a parent re-rendering with a new closure
 * never detaches and reattaches the listener, which during a take would mean
 * dropping whichever key was pressed in between.
 */
export function useShortcuts(
  handler: (action: ShortcutAction, event: KeyboardEvent) => void,
  enabled = true,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.repeat && event.key === " ") return;
      if (isEditableTarget(event.target)) return;

      const action = actionForEvent(event);
      if (!action) return;

      // Claimed: stop the page scrolling under a Space or an arrow.
      event.preventDefault();
      handlerRef.current(action, event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
