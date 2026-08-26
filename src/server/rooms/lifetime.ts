import { and, eq, gt } from "drizzle-orm";

import { rooms } from "~/server/db/schema";
import { staleCutoff } from "~/server/rooms/window";

export {
  STALE_ROOM_MS,
  expiredRatherThanEnded,
  isLive,
  staleCutoff,
} from "~/server/rooms/window";

/**
 * `isLive` as a query predicate.
 *
 * Every read that means "live" goes through this, so the five minutes is true
 * the moment it elapses rather than the next time this account happens to load
 * a dashboard. It also guards the writes, so nothing can drag a room back over
 * the line after its window has run out.
 */
export const stillLive = () =>
  and(eq(rooms.status, "live"), gt(rooms.lastActiveAt, staleCutoff()));
