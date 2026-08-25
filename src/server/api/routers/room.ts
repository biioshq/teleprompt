import { and, desc, eq, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  DEFAULT_PROMPTER_STATE,
  normaliseState,
  parseState,
  prompterStateSchema,
} from "~/lib/prompter/state";
import { scriptWordCount } from "~/lib/markdown/blocks";
import {
  generateChannelKey,
  generateJoinCode,
  normaliseJoinCode,
} from "~/lib/utils";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db as database } from "~/server/db";
import { roomDevices, rooms, scripts } from "~/server/db/schema";
import { ROLES } from "~/lib/realtime/protocol";

type Db = typeof database;

/** A room nobody has touched for this long is not a live session any more. */
const STALE_ROOM_HOURS = 12;

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

/** Lazy sweep — cheap, and keeps join codes from being hoarded by dead rooms. */
async function endStaleRooms(db: Db, ownerId: string) {
  const cutoff = new Date(Date.now() - STALE_ROOM_HOURS * 60 * 60 * 1000);
  await db
    .update(rooms)
    .set({ status: "ended", endedAt: new Date() })
    .where(
      and(
        eq(rooms.ownerId, ownerId),
        eq(rooms.status, "live"),
        lt(rooms.lastActiveAt, cutoff),
      ),
    );
}

async function allocateJoinCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateJoinCode();
    const clash = await db.query.rooms.findFirst({
      where: and(eq(rooms.code, code), eq(rooms.status, "live")),
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
      await endStaleRooms(ctx.db, ctx.session.user.id);

      const script = await ctx.db.query.scripts.findFirst({
        where: and(
          eq(scripts.id, input.scriptId),
          eq(scripts.ownerId, ctx.session.user.id),
        ),
      });
      if (!script) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That script does not exist, or is not yours.",
        });
      }

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
      return {
        ...room,
        state: parseState(room.state),
        wordCount: scriptWordCount(room.content),
        devices,
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
          eq(rooms.status, "live"),
        ),
      });
      if (!room) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "No live room with that code on this account. Check the code, and check both devices are signed in as the same person.",
        });
      }
      return { id: room.id, title: room.title, code: room.code };
    }),

  /** Live rooms for the dashboard. */
  listLive: protectedProcedure.query(async ({ ctx }) => {
    await endStaleRooms(ctx.db, ctx.session.user.id);
    const live = await ctx.db.query.rooms.findMany({
      where: and(
        eq(rooms.ownerId, ctx.session.user.id),
        eq(rooms.status, "live"),
      ),
      orderBy: [desc(rooms.lastActiveAt)],
      limit: 20,
    });
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
          eq(rooms.status, "live"),
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
        columns: { state: true, contentRevision: true, status: true },
      });
      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found." });
      }
      return {
        state: parseState(room.state),
        contentRevision: room.contentRevision,
        status: room.status,
      };
    }),

  /** Register this browser as a device in the room and take a role. */
  join: protectedProcedure
    .input(z.object({ roomId: z.string().uuid(), device: deviceInput }))
    .mutation(async ({ ctx, input }) => {
      const room = await requireRoom(ctx.db, input.roomId, ctx.session.user.id);
      if (room.status === "ended") {
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

      await ctx.db
        .update(rooms)
        .set({ lastActiveAt: new Date() })
        .where(eq(rooms.id, room.id));

      return {
        ...room,
        state: parseState(room.state),
      };
    }),

  heartbeat: protectedProcedure
    .input(
      z.object({
        roomId: z.string().uuid(),
        deviceKey: z.string().min(8).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRoom(ctx.db, input.roomId, ctx.session.user.id);
      const now = new Date();
      await ctx.db
        .update(roomDevices)
        .set({ lastSeenAt: now })
        .where(
          and(
            eq(roomDevices.roomId, input.roomId),
            eq(roomDevices.deviceKey, input.deviceKey),
          ),
        );
      await ctx.db
        .update(rooms)
        .set({ lastActiveAt: now })
        .where(eq(rooms.id, input.roomId));
      return { ok: true };
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

      await ctx.db
        .update(rooms)
        .set({ state: incoming, lastActiveAt: new Date() })
        .where(eq(rooms.id, room.id));
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
      const script = await ctx.db.query.scripts.findFirst({
        where: and(
          eq(scripts.id, room.scriptId),
          eq(scripts.ownerId, ctx.session.user.id),
        ),
      });
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
          // The old anchor points into text that no longer exists.
          state: {
            ...parseState(room.state),
            anchor: { blockIndex: 0, blockFraction: 0 },
            isPlaying: false,
            revision: parseState(room.state).revision + 1,
            updatedAt: Date.now(),
          },
          lastActiveAt: new Date(),
        })
        .where(eq(rooms.id, room.id))
        .returning();

      return {
        ...updated!,
        state: parseState(updated!.state),
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
