/**
 * One registry for every keyboard shortcut.
 *
 * The handlers, the in-app help overlay and the documentation page all read
 * from this list. Before it existed the docs held a hand-written table beside
 * a switch statement in the prompter, and the only thing keeping them honest
 * was someone remembering to edit both.
 */

export type ShortcutAction =
  | "toggle"
  | "next"
  | "previous"
  | "pageForward"
  | "pageBack"
  | "restart"
  | "voice"
  | "faster"
  | "slower"
  | "larger"
  | "smaller"
  | "fullscreen"
  | "mirror"
  | "settings"
  | "help"
  | "close";

export type Surface = "prompter" | "remote";

export type ShortcutGroup = "Playback" | "Pace and type" | "The screen";

export type Shortcut = {
  action: ShortcutAction;
  /** Shown in the help overlay and the docs, in order. */
  keys: string[];
  /** Equivalent keys, shown after an "or". */
  alternates?: string[];
  label: string;
  group: ShortcutGroup;
  surfaces: Surface[];
  /**
   * Only bound when the matching experiment is switched on.
   *
   * Listing it unconditionally would break the rule this registry exists to
   * keep: a key that is in the list is a key that works. So the list is asked
   * whether to include these, and the caller answers from the device's own
   * experiment flags.
   */
  experimental?: true;
};

export const SHORTCUTS: Shortcut[] = [
  {
    action: "toggle",
    keys: ["Space"],
    label: "Play or pause",
    group: "Playback",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "next",
    keys: ["↓"],
    alternates: ["J"],
    label: "Next block",
    group: "Playback",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "previous",
    keys: ["↑"],
    alternates: ["K"],
    label: "Previous block",
    group: "Playback",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "pageForward",
    keys: ["Page Down"],
    label: "Forward most of a screen",
    group: "Playback",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "pageBack",
    keys: ["Page Up"],
    label: "Back most of a screen",
    group: "Playback",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "restart",
    keys: ["Home"],
    alternates: ["R"],
    label: "Back to the top, paused",
    group: "Playback",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "voice",
    keys: ["V"],
    label: "Follow your voice",
    group: "Playback",
    surfaces: ["prompter", "remote"],
    experimental: true,
  },
  {
    action: "faster",
    keys: ["→"],
    label: "Ten words per minute faster",
    group: "Pace and type",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "slower",
    keys: ["←"],
    label: "Ten words per minute slower",
    group: "Pace and type",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "larger",
    keys: ["+"],
    label: "Larger type on the display",
    group: "Pace and type",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "smaller",
    keys: ["−"],
    label: "Smaller type on the display",
    group: "Pace and type",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "fullscreen",
    keys: ["F"],
    label: "Fullscreen",
    group: "The screen",
    surfaces: ["prompter"],
  },
  {
    action: "mirror",
    keys: ["M"],
    label: "Mirror horizontally",
    group: "The screen",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "settings",
    keys: ["S"],
    label: "Open or close settings",
    group: "The screen",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "help",
    keys: ["?"],
    label: "Show this list",
    group: "The screen",
    surfaces: ["prompter", "remote"],
  },
  {
    action: "close",
    keys: ["Esc"],
    label: "Close settings or this list",
    group: "The screen",
    surfaces: ["prompter", "remote"],
  },
];

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  "Playback",
  "Pace and type",
  "The screen",
];

export function shortcutsFor(
  surface: Surface,
  { experimental = false } = {},
): Shortcut[] {
  return SHORTCUTS.filter(
    (shortcut) =>
      shortcut.surfaces.includes(surface) &&
      (experimental || !shortcut.experimental),
  );
}

export function groupedShortcuts(
  surface: Surface,
  options: { experimental?: boolean } = {},
) {
  const items = shortcutsFor(surface, options);
  return SHORTCUT_GROUPS.map((group) => ({
    group,
    items: items.filter((shortcut) => shortcut.group === group),
  })).filter((section) => section.items.length > 0);
}

/**
 * `event.key` straight from the browser is awkward to match on: a space is
 * `" "`, letters carry their own case, and shifted punctuation arrives as the
 * shifted glyph. This flattens it to one token the table below can key on.
 */
function tokenFor(event: KeyboardEvent): string {
  if (event.key === " " || event.key === "Spacebar") return "Space";
  if (event.key.length === 1) return event.key.toLowerCase();
  return event.key;
}

const KEY_BINDINGS: Record<string, ShortcutAction> = {
  Space: "toggle",
  ArrowDown: "next",
  j: "next",
  ArrowUp: "previous",
  k: "previous",
  PageDown: "pageForward",
  PageUp: "pageBack",
  Home: "restart",
  r: "restart",
  v: "voice",
  ArrowRight: "faster",
  ArrowLeft: "slower",
  "+": "larger",
  "=": "larger",
  "-": "smaller",
  _: "smaller",
  f: "fullscreen",
  m: "mirror",
  s: "settings",
  "?": "help",
  "/": "help",
  Escape: "close",
};

/** The action a key event should trigger, or null to let the browser have it. */
export function actionForEvent(event: KeyboardEvent): ShortcutAction | null {
  // Anything with a modifier belongs to the browser or the operating system.
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  return KEY_BINDINGS[tokenFor(event)] ?? null;
}

/** True when the keystroke is meant for whatever the person is typing into. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
