"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr";

/**
 * Registers the worker and, when a new build is waiting, offers a reload
 * rather than swapping the app out from under someone mid-take.
 */
export function ServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    let registration: ServiceWorkerRegistration | null = null;

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (registration.waiting) setWaiting(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration?.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaiting(installing);
            }
          });
        });
      } catch {
        // A failed registration is not worth interrupting anyone over; the app
        // works fine without offline support.
      }
    };

    void register();

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] print:hidden">
      <div className="flex items-center gap-3 rounded-sm border border-ink bg-surface px-4 py-3 shadow-hard">
        <span className="text-sm text-ink">A new version is ready.</span>
        <button
          type="button"
          onClick={() => waiting.postMessage("SKIP_WAITING")}
          className="inline-flex items-center gap-1.5 rounded-xs border border-ink bg-brand px-2.5 py-1 text-[0.8125rem] font-medium text-ink"
        >
          <ArrowClockwise size={14} weight="bold" />
          Reload
        </button>
      </div>
    </div>
  );
}
