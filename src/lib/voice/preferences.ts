"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-device voice settings.
 *
 * Everything else about a session is a property of the *room* and syncs to
 * every device in it. This deliberately is not. Which language you are reading
 * in is a statement about the browser in front of you and the person speaking
 * at it, so setting it on a phone has no business changing what a laptop does.
 *
 * This module is what is left of the old experiments store. Voice tracking
 * used to be a switch you had to find and turn on; now it is simply a feature,
 * and the only thing worth remembering per device is the language.
 */

export type VoicePreferences = {
  /** BCP-47 tag for recognition, or "auto" for the browser's own language. */
  language: string;
};

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  language: "auto",
};

const STORAGE_KEY = "teleprompt:voice";
/** Where the language lived while voice tracking was still an experiment. */
const LEGACY_STORAGE_KEY = "teleprompt:experiments";
const CHANGE_EVENT = "teleprompt:voice-change";

/**
 * The snapshot handed to React.
 *
 * `useSyncExternalStore` compares snapshots by identity and will loop forever
 * if a new object comes back every time it asks, so this is a module-level
 * cache that is only ever replaced when something genuinely changed.
 */
let cache: VoicePreferences = DEFAULT_VOICE_PREFERENCES;
let hydrated = false;

function languageFrom(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    // The new key stores `language`; the old one stored `voiceLanguage`.
    const value = record.language ?? record.voiceLanguage;
    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

function read(): VoicePreferences {
  if (typeof window === "undefined") return DEFAULT_VOICE_PREFERENCES;
  try {
    const language =
      languageFrom(window.localStorage.getItem(STORAGE_KEY)) ??
      // Carry over a choice made before the rename rather than silently
      // resetting somebody to "auto".
      languageFrom(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    return language ? { language } : DEFAULT_VOICE_PREFERENCES;
  } catch {
    // A private window with storage denied, or something else's key on the
    // same origin. Defaults are a fine answer to both.
    return DEFAULT_VOICE_PREFERENCES;
  }
}

function refresh() {
  const next = read();
  if (next.language !== cache.language) cache = next;
}

function getSnapshot(): VoicePreferences {
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

export function setVoiceLanguage(language: string) {
  if (language === cache.language) return;
  cache = { language };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage refused. The choice still applies to this session, which is the
    // part that matters right now.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useVoicePreferences() {
  const preferences = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => DEFAULT_VOICE_PREFERENCES,
  );

  const setLanguage = useCallback(
    (language: string) => setVoiceLanguage(language),
    [],
  );

  return [preferences, setLanguage] as const;
}
