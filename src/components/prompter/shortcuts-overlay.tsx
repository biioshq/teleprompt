"use client";

import { X } from "@phosphor-icons/react/dist/ssr";

import { KbdCombo } from "~/components/ui/kbd";
import { groupedShortcuts, type Surface } from "~/lib/keyboard/shortcuts";

/**
 * The shortcut list, in the app rather than only in the docs.
 *
 * Reads the same registry the handlers do, so a key that works is a key that
 * is listed. Opened with `?`, which is itself in the list.
 */
export function ShortcutsOverlay({
  surface,
  open,
  onClose,
}: {
  surface: Surface;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const sections = groupedShortcuts(surface);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 pt-[calc(1rem+env(safe-area-inset-top))] pr-[calc(1rem+env(safe-area-inset-right))] pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-lg border border-stage-line bg-stage-raised p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-stage-ink">
              Keyboard shortcuts
            </h2>
            <p className="mt-1 text-[0.8125rem] text-stage-muted">
              {surface === "remote"
                ? "This device drives the display. Most presenter clickers send Page Up and Page Down, so they work here too."
                : "Most presenter clickers send Page Up and Page Down, so they work without any setup."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-stage-muted transition-colors hover:text-stage-ink"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.group}>
              <h3 className="mb-2.5 font-mono text-[0.625rem] tracking-[0.14em] text-stage-muted uppercase">
                {section.group}
              </h3>
              <ul className="divide-y divide-stage-line">
                {section.items.map((shortcut) => (
                  <li
                    key={shortcut.action}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <span className="text-[0.875rem] text-stage-ink">
                      {shortcut.label}
                    </span>
                    <KbdCombo shortcut={shortcut} tone="stage" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-6 text-[0.75rem] leading-relaxed text-stage-muted">
          Nothing fires while you are typing in a field, and anything held with
          Ctrl, Cmd or Alt is left to the browser.
        </p>
      </div>
    </div>
  );
}
