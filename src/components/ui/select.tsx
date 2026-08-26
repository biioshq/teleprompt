"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CaretDown, Check } from "@phosphor-icons/react/dist/ssr";

import { cn } from "~/lib/utils";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

/**
 * A select that stays inside the design system.
 *
 * A native `<select>` cannot: the option list is drawn by the operating system,
 * so a menu on a warm paper panel arrives in whatever grey the platform feels
 * like, and the caret is painted inside the control's own padding box with no
 * room left after it. This is the APG select-only combobox (a button that owns
 * its caret and a listbox we paint ourselves), so the open state reads as part
 * of the same surface as the closed one.
 *
 * Focus never leaves the button; the active option is named by
 * `aria-activedescendant`, which is what a screen reader announces as the
 * arrows move.
 */

/** Distance from the trigger, and the closest the menu may come to an edge. */
const GAP = 4;
const EDGE = 8;

type Anchor = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (index: number) => `${uid}-option-${index}`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  /* The menu is `fixed` rather than absolutely placed inside a wrapper: this
     control lives in dialogs that scroll their own body, and an in-flow menu
     would either be clipped by that scroller or lengthen it. Fixed placement
     costs a measure-and-position pass, which is what this is. */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;

    const list = listRef.current;
    const wanted = list?.scrollHeight ?? 0;
    const dropUp = wanted > below && above > below;
    const width = Math.max(rect.width, list?.offsetWidth ?? 0);

    setAnchor({
      left: Math.max(
        EDGE,
        Math.min(rect.left, window.innerWidth - width - EDGE),
      ),
      width: rect.width,
      top: dropUp ? undefined : rect.bottom + GAP,
      bottom: dropUp ? window.innerHeight - rect.top + GAP : undefined,
      maxHeight: Math.max(96, dropUp ? above : below),
    });
  }, []);

  /* Placed in a layout effect so the menu is measured and moved before the
     browser paints it; hence `visibility: hidden` until an anchor exists.
     Dropping the anchor on close forces a fresh measure on the next open. */
  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    window.addEventListener("resize", reposition);
    // Capture: the scroll that moves this control is usually a dialog body's,
    // and those events do not reach the window on their own.
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: "nearest" });
    // `optionId` is derived from a stable `useId`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const commit = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          setActive(selected);
          setOpen(true);
          return;
        }
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((index) =>
          Math.min(options.length - 1, Math.max(0, index + step)),
        );
        return;
      }
      case "Home":
      case "End": {
        if (!open) return;
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : options.length - 1);
        return;
      }
      case "Enter":
      case " ": {
        // Held even when closed: this control sits inside forms, and an Enter
        // that falls through opens the menu and submits in the same breath.
        event.preventDefault();
        if (!open) {
          setActive(selected);
          setOpen(true);
          return;
        }
        commit(active);
        return;
      }
      case "Escape": {
        if (!open) return;
        event.preventDefault();
        setOpen(false);
        return;
      }
      case "Tab": {
        if (open) setOpen(false);
        return;
      }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={() => {
          setActive(selected);
          setOpen((wasOpen) => !wasOpen);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex h-9 items-center justify-between gap-2 rounded-sm border bg-surface",
          "py-0 pr-2.5 pl-3 text-left text-[0.8125rem] text-ink transition-colors",
          "disabled:pointer-events-none disabled:opacity-50",
          open ? "border-ink" : "border-line hover:border-line-firm",
          className,
        )}
      >
        <span className="truncate">{options[selected]?.label ?? ""}</span>
        <CaretDown
          size={11}
          weight="bold"
          aria-hidden
          className={cn(
            "shrink-0 text-faint transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          style={{
            left: anchor?.left ?? 0,
            top: anchor?.top,
            bottom: anchor?.bottom,
            minWidth: anchor?.width,
            maxHeight: anchor?.maxHeight,
            visibility: anchor ? "visible" : "hidden",
          }}
          className={cn(
            "fixed z-50 max-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain",
            "rounded-sm border border-ink bg-surface py-1 shadow-hard",
          )}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === value}
              onPointerEnter={() => setActive(index)}
              onClick={() => commit(index)}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[0.8125rem]",
                index === active ? "bg-paper-deep text-ink" : "text-ink-soft",
              )}
            >
              <Check
                size={12}
                weight="bold"
                aria-hidden
                className={cn(
                  "shrink-0 text-brand",
                  option.value === value ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="truncate">{option.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
