import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  DEFAULT_PROMPTER_STATE,
  normaliseState,
  parseState,
  prompterStateSchema,
} from "~/lib/prompter/state";
import { scriptWordCount, splitIntoBlocks } from "~/lib/markdown/blocks";
import {
  generateChannelKey,
  generateJoinCode,
  normaliseJoinCode,
} from "~/lib/utils";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
// Type-only: naming the client's type must not drag the client itself (and
// its connection pool, and its environment validation) into every module that
// mentions a query.
import type { db as database } from "~/server/db";
import { roomDevices, rooms, scripts } from "~/server/db/schema";
import { requireScript } from "~/server/library/access";
import {
  expiredRatherThanEnded,
  isLive,
  staleCutoff,
  stillLive,
} from "~/server/rooms/lifetime";
import { ROLES } from "~/lib/realtime/protocol";

type Db = typeof database;

async function requireRoom(db: Db, id: string, ownerId: string) {
  const room = await db.query.rooms.findFirst({
    where: and(eq(rooms.id, id), eq(rooms.ownerId, ownerId)),
  });
  if (!room) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message:
        "That room does not exist on this account. Rooms are only visible to the account that opened them.",
    });
  }
  return room;
}

/**
 * Housekeeping, not enforcement.
 *
 * `stillLive` is what makes the five minutes true; this is what stamps
 * `endedAt`, releases the device records, and lets the row stop pretending. It
 * runs whenever this account opens a room or loads a dashboard: late, but
 * never wrong, because nothing reads a stale room as live in the meantime.
 */
async function endStaleRooms(db: Db, ownerId: string) {
  const ended = await db
    .update(rooms)
    .set({ status: "ended", endedAt: new Date() })
    .where(
      and(
        eq(rooms.ownerId, ownerId),
        eq(rooms.status, "live"),
        lt(rooms.lastActiveAt, staleCutoff()),
      ),
    )
    .returning({ id: rooms.id });
  if (ended.length === 0) return;

  // Closing a room takes its device records with it, whichever way it closed.
  // `end` has always done this; the privacy notice says both do.
  await db.delete(roomDevices).where(
    inArray(
      roomDevices.roomId,
      ended.map((room) => room.id),
    ),
  );
}

async function allocateJoinCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateJoinCode();
    const clash = await db.query.rooms.findFirst({
      where: and(eq(rooms.code, code), stillLive()),
      columns: { id: true },
    });
    if (!clash) return code;
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Could not allocate a join code. Try again.",
  });
}

const deviceInput = z.object({
  deviceKey: z.string().min(8).max(64),
  label: z.string().min(1).max(80),
  platform: z.string().max(160).optional(),
  role: z.enum(ROLES),
});

export const roomRouter = createTRPCRouter({
  /** Open a live room from a script. */
  create: protectedProcedure
    .input(z.object({ scriptId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Being able to read a script is enough to present it. View-only means
      // you may not change the words, not that you may not say them. And the
      // room that opens is yours: your join code, your devices, your position
      // in the text. The owner's copy is untouched.
      //
      // The sweep is housekeeping and decides nothing here: it only ever ends
      // rooms already past their window, which is the same set every `stillLive`
      // predicate below already excludes. So it runs alongside the permission
      // check rather than delaying it: this is the "Present" button, and it is
      // the one place in the app where waiting is most obvious.
      const [, { script }] = await Promise.all([
        endStaleRooms(ctx.db, ctx.session.user.id),
        requireScript(ctx.db, ctx.viewer, input.scriptId, "viewer"),
      ]);

      const code = await allocateJoinCode(ctx.db);

      const [room] = await ctx.db
        .insert(rooms)
        .values({
          ownerId: ctx.session.user.id,
          scriptId: script.id,
          code,
          channelKey: generateChannelKey(),
          title: script.title,
          content: script.body,
          contentRevision: 1,
          state: { ...DEFAULT_PROMPTER_STATE, updatedAt: Date.now() },
          // Explicit rather than the column's `CURRENT_TIMESTAMP` default: the
          // window is judged against this process's clock, so a room has to be
          // born on that clock or skew could make it expire before it opens.
          lastActiveAt: new Date(),
        })
        .returning();

      if (!room) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not open the room.",
        });
      }
      return room;
    }),

  /**
   * Full room record, including the channel key. This is the only place the
   * key is ever returned, and only to the owning account.
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const room = await requireRoom(ctx.db, input.id, ctx.session.user.id);
      const devices = await ctx.db.query.roomDevices.findMany({
        where: eq(roomDevices.roomId, room.id),
        orderBy: [desc(roomDevices.lastSeenAt)],
      });
      const live = isLive(room);
      return {
        ...room,
        // The room page has to render "Room ended", so the row comes back
        // either way, but it must not claim to be live past the cutoff.
        status: live ? ("live" as const) : ("ended" as const),
        // So the page can say what happened rather than assume the window ran
        // out on a room somebody closed deliberately.
        closedReason: live
          ? null
          : expiredRatherThanEnded(room)
            ? ("expired" as const)
            : ("closed" as const),
        state: parseState(room.state),
        wordCount: scriptWordCount(room.content),
        // A closed room has released these, or is about to when the next sweep
        // reaches it. Listing them under a heading that says the room is over
        // would contradict both the screen and the privacy notice.
        devices: live ? devices : [],
      };
    }),

  /** Resolve a typed join code to a room on the signed-in account. */
  byCode: protectedProcedure
    .input(z.object({ code: z.string().min(3).max(16) }))
    .query(async ({ ctx, input }) => {
      const code = normaliseJoinCode(input.code);
      const room = await ctx.db.query.rooms.findFirst({
        where: and(
          eq(rooms.code, code),
          eq(rooms.ownerId, ctx.session.user.id),
          stillLive(),
        ),
      });
      if (!room) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "No live room with that code on this account. Rooms close after five quiet minutes, so it may have run out; otherwise check the code, and check both devices are signed in as the same person.",
        });
      }
      return { id: room.id, title: room.title, code: room.code };
    }),

  /** Live rooms for the dashboard. */
  listLive: protectedProcedure.query(async ({ ctx }) => {
    // The sweep and the listing touch disjoint rows by construction (one ends
    // rooms last active before the cutoff, the other returns rooms last active
    // after it), so waiting for the first before starting the second bought
    // nothing but a round trip on every dashboard load.
    const [, live] = await Promise.all([
      endStaleRooms(ctx.db, ctx.session.user.id),
      ctx.db.query.rooms.findMany({
        where: and(eq(rooms.ownerId, ctx.session.user.id), stillLive()),
        orderBy: [desc(rooms.lastActiveAt)],
        limit: 20,
      }),
    ]);
    return live.map((room) => ({
      id: room.id,
      code: room.code,
      title: room.title,
      lastActiveAt: room.lastActiveAt,
      createdAt: room.createdAt,
    }));
  }),

  /**
   * The newest live room for a script, if there is one.
   *
   * Without this, the editor's only move is to open another room every time
   * the button is pressed, stranding the code the other device already has.
   */
  activeForScript: protectedProcedure
    .input(z.object({ scriptId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const room = await ctx.db.query.rooms.findFirst({
        where: and(
          eq(rooms.scriptId, input.scriptId),
          eq(rooms.ownerId, ctx.session.user.id),
          stillLive(),
        ),
        orderBy: [desc(rooms.lastActiveAt)],
        columns: {
          id: true,
          code: true,
          title: true,
          lastActiveAt: true,
          createdAt: true,
        },
      });
      return room ?? null;
    }),

  /**
   * Just the playback state, kept deliberately small.
   *
   * This is the degraded path: when a device cannot hold a realtime channel,
   * it polls this instead. Slower and coarser than the wire protocol, but it
   * keeps a session usable on a network that blocks WebSockets entirely.
   */
  getState: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const room = await ctx.db.query.rooms.findFirst({
        where: and(
          eq(rooms.id, input.roomId),
          eq(rooms.ownerId, ctx.session.user.id),
        ),
        columns: {
          state: true,
          contentRevision: true,
          status: true,
          lastActiveAt: true,
        },
      });
      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found." });
      }
      return {
        state: parseState(room.state),
        contentRevision: room.contentRevision,
        status: isLive(room) ? ("live" as const) : ("ended" as const),
      };
    }),

  /** Register this browser as a device in the room and take a role. */
  join: protectedProcedure
    .input(z.object({ roomId: z.string().uuid(), device: deviceInput }))
    .mutation(async ({ ctx, input }) => {
      const room = await requireRoom(ctx.db, input.roomId, ctx.session.user.id);

      // The bump is the gate. Checking the row we just read and then writing
      // would leave a window for the room to expire in between; this way the
      // room is live as of the statement that claims it, or not at all.
      const [touched] = await ctx.db
        .update(rooms)
        .set({ lastActiveAt: new Date() })
        .where(and(eq(rooms.id, room.id), stillLive()))
        .returning({ id: rooms.id });
      if (!touched) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This room has ended. Open a new one from the script.",
        });
      }

      await ctx.db
        .insert(roomDevices)
        .values({
          roomId: room.id,
          userId: ctx.session.user.id,
          deviceKey: input.device.deviceKey,
          role: input.device.role,
          label: input.device.label,
          platform: input.device.platform,
        })
        .onConflictDoUpdate({
          target: [roomDevices.roomId, roomDevices.deviceKey],
          set: {
            role: input.device.role,
            label: input.device.label,
            platform: input.device.platform,
            lastSeenAt: new Date(),
          },
        });

      return {
        ...room,
        // Not the snapshot's status: the update above is what settled it.
        status: "live" as const,
        state: parseState(room.state),
      };
    }),

  /**
   * Say the room is still in use.
   *
   * `deviceKey` is optional because the room page beats too, and it is not a
   * device; it is a person looking at the join code. Passing no key keeps it
   * out of the device list rather than refreshing whatever row this browser
   * left behind the last time it took a role.
   */
  heartbeat: protectedProcedure
    .input(
      z.object({
        roomId: z.string().uuid(),
        deviceKey: z.string().min(8).max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRoom(ctx.db, input.roomId, ctx.session.user.id);
      const now = new Date();

      // Guarded, so a device coming back from a long sleep cannot drag a room
      // back over the line. If this matches nothing the session is over, and
      // this is the one call that can say so to a device that is still trying.
      const [touched] = await ctx.db
        .update(rooms)
        .set({ lastActiveAt: now })
        .where(and(eq(rooms.id, input.roomId), stillLive()))
        .returning({ id: rooms.id });
      if (!touched) return { live: false };

      if (input.deviceKey) {
        await ctx.db
          .update(roomDevices)
          .set({ lastSeenAt: now })
          .where(
            and(
              eq(roomDevices.roomId, input.roomId),
              eq(roomDevices.deviceKey, input.deviceKey),
            ),
          );
      }
      return { live: true };
    }),

  leave: protectedProcedure
    .input(
      z.object({
        roomId: z.string().uuid(),
        deviceKey: z.string().min(8).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRoom(ctx.db, input.roomId, ctx.session.user.id);
      await ctx.db
        .delete(roomDevices)
        .where(
          and(
            eq(roomDevices.roomId, input.roomId),
            eq(roomDevices.deviceKey, input.deviceKey),
          ),
        );
      return { ok: true };
    }),

  /**
   * Durable copy of the live state. The wire protocol is the fast path; this is
   * only so a device that reloads or reconnects lands on the right line instead
   * of jumping back to the top of the script.
   */
  saveState: protectedProcedure
    .input(
      z.object({
        roomId: z.string().uuid(),
        state: prompterStateSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await requireRoom(ctx.db, input.roomId, ctx.session.user.id);
      const incoming = normaliseState(input.state);
      const current = parseState(room.state);

      // Two devices can both flush; the higher revision is the newer truth.
      if (incoming.revision < current.revision) return current;

      // Guarded so a flush cannot revive a room that has run out. No error
      // when it matches nothing: the driver flushes every couple of seconds
      // and the heartbeat is what tells it the session is over.
      await ctx.db
        .update(rooms)
        .set({ state: incoming, lastActiveAt: new Date() })
        .where(and(eq(rooms.id, room.id), stillLive()));
      return incoming;
    }),

  /** Pull the latest edits of the source script into the live room. */
  refreshContent: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const room = await requireRoom(ctx.db, input.roomId, ctx.session.user.id);
      if (!room.scriptId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The script behind this room was deleted.",
        });
      }
      // Read access, not ownership: a room opened from a script somebody
      // shared has to be able to pull that script's later edits in, or it goes
      // stale the moment its author fixes a line.
      const viewer = ctx.viewer;
      const script = await requireScript(
        ctx.db,
        viewer,
        room.scriptId,
        "viewer",
      )
        .then((result) => result.script)
        .catch(() => null);
      if (!script) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The script behind this room is no longer available.",
        });
      }

      const [updated] = await ctx.db
        .update(rooms)
        .set({
          title: script.title,
          content: script.body,
          contentRevision: sql`${rooms.contentRevision} + 1`,
          // Keep the reader where they were. Clamping the block index is not
          // exact - text inserted above shifts them - but resetting to the top
          // of the script because something changed further down is worse.
          state: (() => {
            const current = parseState(room.state);
            const lastBlock = Math.max(
              0,
              splitIntoBlocks(script.body).length - 1,
            );
            const blockIndex = Math.min(current.anchor.blockIndex, lastBlock);
            return {
              ...current,
              anchor: {
                blockIndex,
                blockFraction:
                  blockIndex === current.anchor.blockIndex
                    ? current.anchor.blockFraction
                    : 0,
              },
              revision: current.revision + 1,
              updatedAt: Date.now(),
            };
          })(),
          lastActiveAt: new Date(),
        })
        .where(and(eq(rooms.id, room.id), stillLive()))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This room has ended. Open a new one from the script.",
        });
      }

      return {
        ...updated,
        state: parseState(updated.state),
      };
    }),

  end: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireRoom(ctx.db, input.roomId, ctx.session.user.id);
      await ctx.db
        .update(rooms)
        .set({ status: "ended", endedAt: new Date() })
        .where(eq(rooms.id, input.roomId));
      await ctx.db
        .delete(roomDevices)
        .where(eq(roomDevices.roomId, input.roomId));
      return { ok: true };
    }),
});
