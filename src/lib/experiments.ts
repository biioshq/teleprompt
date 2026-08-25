"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-device switches for features that are not finished.
 *
 * Everything else about a session is a property of the *room* and syncs to
 * every device in it. These deliberately are not. An experiment is a statement
 * about the browser in front of you — whether it can do the thing at all, and
 * whether you are willing to have it try during a take — so turning one on
 * from a phone has no business changing what a laptop does.
 *
 * Stored in `localStorage` rather than the database for the same reason, and
 * because a flag that survives a reload but not a different machine is exactly
 * the scope an experiment should have.
 */

export type Experiments = {
  /**
   * Follow the reader's voice and scroll the script to match, using the
   * browser's own speech recognition.
   */
  voiceTracking: boolean;
  /** BCP-47 tag for recognition, or "auto" for the browser's own language. */
  voiceLanguage: string;
};

export const DEFAULT_EXPERIMENTS: Experiments = {
  voiceTracking: false,
  voiceLanguage: "auto",
};

const STORAGE_KEY = "teleprompt:experiments";
const CHANGE_EVENT = "teleprompt:experiments-change";

/**
 * The snapshot handed to React.
 *
 * `useSyncExternalStore` compares snapshots by identity and will loop forever
 * if a new object comes back every time it asks, so this is a module-level
 * cache that is only ever replaced when something genuinely changed.
 */
let cache: Experiments = DEFAULT_EXPERIMENTS;
let hydrated = false;

function read(): Experiments {
  if (typeof window === "undefined") return DEFAULT_EXPERIMENTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EXPERIMENTS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_EXPERIMENTS;
    const record = parsed as Record<string, unknown>;
    return {
      voiceTracking: record.voiceTracking === true,
      voiceLanguage:
        typeof record.voiceLanguage === "string" && record.voiceLanguage
          ? record.voiceLanguage
          : DEFAULT_EXPERIMENTS.voiceLanguage,
    };
  } catch {
    // A private window with storage denied, or something else's key on the
    // same origin. Defaults are a fine answer to both.
    return DEFAULT_EXPERIMENTS;
  }
}

function same(a: Experiments, b: Experiments) {
  return (
    a.voiceTracking === b.voiceTracking && a.voiceLanguage === b.voiceLanguage
  );
}

function refresh() {
  const next = read();
  if (!same(next, cache)) cache = next;
}

function getSnapshot(): Experiments {
  if (!hydrated) {
    hydrated = true;
    refresh();
  }
  return cache;
}

function subscribe(onChange: () => void) {
  const handler = () => {
    refresh();
    onChange();
  };
  // `storage` covers the other tab; the custom event covers this one, which
  // the browser does not notify about its own writes.
  window.addEventListener("storage", handler);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

export function setExperiment<K extends keyof Experiments>(
  key: K,
  value: Experiments[K],
) {
  const next = { ...getSnapshot(), [key]: value };
  if (same(next, cache)) return;
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage refused. The flag still applies to this session, which is the
    // part that matters right now.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useExperiments() {
  const experiments = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => DEFAULT_EXPERIMENTS,
  );

  const set = useCallback(
    <K extends keyof Experiments>(key: K, value: Experiments[K]) =>
      setExperiment(key, value),
    [],
  );

  return [experiments, set] as const;
}
