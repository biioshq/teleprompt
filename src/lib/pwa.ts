"use client";

import { useCallback, useEffect, useState } from "react";

import { isStandalone } from "~/lib/device";

/**
 * The install event is not in lib.dom, and it only exists on Chromium.
 * Safari never fires it, which is why the UI has an iOS branch.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState =
  "unavailable" | "installable" | "installed" | "ios-manual";

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [state, setState] = useState<InstallState>("unavailable");

  useEffect(() => {
    if (isStandalone()) {
      setState("installed");
      return;
    }

    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIos) setState("ios-manual");

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setState("installable");
    };
    const onInstalled = () => {
      setDeferred(null);
      setState("installed");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return "dismissed" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setState("installed");
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return { state, install };
}

/**
 * Keeps the display awake while a take is running. Without it a phone acting
 * as the prompter dims halfway through the second paragraph.
 */
export function useWakeLock(active: boolean) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        setHeld(true);
        sentinel.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false);
      }
    };

    // The lock is dropped whenever the tab is hidden, so it has to be retaken.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
      setHeld(false);
    };
  }, [active]);

  return held;
}
