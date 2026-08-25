import { DEFAULT_PROMPTER_STATE, clamp } from "~/lib/prompter/state";

/**
 * The type size the remote's mirror should use, from the room's shared size
 * and the width of the device showing it.
 *
 * Two things this has to get right. It must track the shared setting, so that
 * resizing from either device moves both. And it must suit the device it is
 * on: a phone in the hand and a tablet on a stand want very different pixel
 * sizes for the same script.
 *
 * The first attempt multiplied the shared size by a fixed 0.34 and clamped the
 * result to 15-34px. That was tuned for a phone and behaved badly everywhere:
 * 21 of the 35 available steps produced no visible change at all, because
 * anything below a shared 45px pinned to the floor and anything above 99px
 * pinned to the ceiling. The number moved and the text did not, which is
 * exactly what a broken control looks like. On a tablet it was worse, since
 * 34px is small on a wide screen, so it sat at the ceiling almost immediately.
 *
 * So the base is a comfortable size for this viewport - roughly a two-dozen
 * character line - and the shared setting is applied as a ratio against the
 * room default. Every step moves, and a tablet gets tablet-sized text.
 */
const CHARS_PER_LINE = 24;
const ABSOLUTE_MIN_PX = 11;
/** Below this the base stops shrinking; narrower devices still need to read. */
const BASE_MIN_PX = 13;
/** Above this a larger screen stops inflating the base on its own. */
const BASE_MAX_PX = 40;

export function mirrorFontSize(
  sharedFontSize: number,
  viewportWidth: number,
): number {
  const base = clamp(viewportWidth / CHARS_PER_LINE, BASE_MIN_PX, BASE_MAX_PX);
  const ratio = sharedFontSize / DEFAULT_PROMPTER_STATE.fontSize;
  return clamp(
    Math.round(base * ratio),
    ABSOLUTE_MIN_PX,
    Math.round(viewportWidth / 7),
  );
}
