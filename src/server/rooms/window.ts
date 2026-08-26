/**
 * How long a room outlives the last thing that touched it.
 *
 * Kept free of any database import so the rule can be stated and tested
 * directly; the drizzle predicate that applies it to a query lives next door in
 * `lifetime.ts`. Run with `npm test`.
 */

/**
 * A room is a live session, and a live session is one something is still on.
 *
 * Five minutes is short enough that an abandoned room hands its join code back
 * while the person who abandoned it is still in the building, and long enough
 * that a device can lose its network and reconnect inside the window.
 */
export const STALE_ROOM_MS = 5 * 60 * 1000;

/** A room must have been active since this instant to still count as live. */
export const staleCutoff = () => new Date(Date.now() - STALE_ROOM_MS);

/**
 * Live in the column and live by the clock: a room needs both.
 *
 * The stored status is bookkeeping that catches up whenever this account next
 * opens a room or loads a dashboard, so on its own it will happily call a room
 * live minutes after it went quiet. The timestamp is what makes the window
 * true the moment it elapses.
 */
export const isLive = (room: { status: string; lastActiveAt: Date }) =>
  room.status === "live" &&
  room.lastActiveAt.getTime() > Date.now() - STALE_ROOM_MS;

/**
 * Whether a closed room ran out rather than being closed on purpose.
 *
 * Both endings stamp `endedAt`, so the stamp alone cannot tell them apart, but
 * the sweep only ever ends a room that was already past its window, so the gap
 * between the last activity and the ending is what gives it away. A room dead
 * by the clock that no sweep has reached yet has no stamp at all.
 *
 * Worth the small arithmetic because the alternative is telling someone their
 * room went quiet for five minutes moments after they ended it themselves.
 */
export const expiredRatherThanEnded = (room: {
  endedAt: Date | null;
  lastActiveAt: Date;
}) =>
  room.endedAt === null ||
  room.endedAt.getTime() - room.lastActiveAt.getTime() >= STALE_ROOM_MS;
