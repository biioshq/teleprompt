import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  inferTitle,
  scriptWordCount,
  splitIntoBlocks,
} from "~/lib/markdown/blocks";
import { parseState } from "~/lib/prompter/state";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
// Type-only: naming the client's type must not drag the client itself (and its
// connection pool, and its environment validation) into every module that
// mentions a query.
import type { db as database } from "~/server/db";
import { rooms, scripts } from "~/server/db/schema";
import { requireFolder, requireScript } from "~/server/library/access";
import { stillLive } from "~/server/rooms/lifetime";

type Db = typeof database;
type Script = typeof scripts.$inferSelect;

const idInput = z.object({ id: z.string().uuid() });

const STARTER_SCRIPT = `# Welcome to Teleprompt

Open this script on the device your audience sees, then open the remote on your
phone. Both screens hold the same words, and the phone decides which words.

:: breathe, look at the lens

## What to try first

- Press play on the remote and watch this screen move.
- Slide the speed control; the pace follows you instantly.
- Tap a line on the remote to jump the display straight to it.

Anything you can write in Markdown works here. Headings break a script into
sections, lists give you one beat per bullet, and a line that begins with two
colons becomes a cue: visible to you, never read aloud.

:: pause here, then land the closing line

That is the whole product. Write, connect, present.
`;

/**
 * Push an edited script into any room that is currently showing it.
 *
 * A room holds a snapshot rather than a live reference, because both devices
 * have to render byte-identical text for block indices to mean the same thing
 * on each. That requirement has not changed. What has changed is who is
 * responsible for keeping the snapshot current: it used to be the person,
 * through a button on the room page, and forgetting to press it left two
 * devices syncing positions against two different texts.
 *
 * The reading position is carried over rather than reset. Clamping the block
 * index is not perfect - inserting a paragraph above where someone is reading
 * shifts them by one - but it is far better than throwing them back to the top
 * of the script because a typo was fixed further down.
 *
 * Note this counts as activity on the room: pushing an edit in refreshes the
 * five-minute window, so a script being worked on in one tab keeps its room
 * alive in another.
 */
async function syncLiveRooms(db: Db, script: Script) {
  // Every live room showing this script, whoever opened it. A script can now
  // be edited by somebody other than its owner and presented by somebody else
  // again, and a room that is one edit behind is a room syncing two devices
  // against two different texts, which is the failure this whole mechanism
  // exists to prevent, regardless of whose account the room is on.
  const live = await db.query.rooms.findMany({
    where: and(eq(rooms.scriptId, script.id), stillLive()),
  });
  if (live.length === 0) return;

  const blockCount = splitIntoBlocks(script.body).length;
  const lastBlock = Math.max(0, blockCount - 1);
  const now = new Date();

  // Together rather than one after another. This runs inside every save of a
  // script's body, and the editor autosaves, so a second room used to mean a
  // second round trip added to every pause in typing, for rooms that cannot
  // affect each other's outcome.
  await Promise.all(
    live.map((room) => {
      if (room.content === script.body && room.title === script.title) return;

      const current = parseState(room.state);
      const blockIndex = Math.min(current.anchor.blockIndex, lastBlock);
      const keptExactly = blockIndex === current.anchor.blockIndex;

      return (
        db
          .update(rooms)
          .set({
            title: script.title,
            content: script.body,
            contentRevision: sql`${rooms.contentRevision} + 1`,
            state: {
              ...current,
              anchor: {
                blockIndex,
                blockFraction: keptExactly ? current.anchor.blockFraction : 0,
              },
              revision: current.revision + 1,
              updatedAt: Date.now(),
            },
            lastActiveAt: now,
          })
          // Guarded as well as the read above: a room that was live when it was
          // selected can run out before its update lands.
          .where(and(eq(rooms.id, room.id), stillLive()))
      );
    }),
  );
}

export const scriptRouter = createTRPCRouter({
  /** Everything on the account, ignoring folders. Used for search and pickers. */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.scripts.findMany({
      where: eq(scripts.ownerId, ctx.session.user.id),
      orderBy: [desc(scripts.updatedAt)],
      limit: 200,
    });
  }),

  byId: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
    const viewer = ctx.viewer;
    const { script, access } = await requireScript(
      ctx.db,
      viewer,
      input.id,
      "viewer",
    );
    // The editor needs to know before it renders whether the fields it is
    // about to show are fields this person may change. Working it out from a
    // failed save afterwards means letting them type first.
    return { ...script, access };
  }),

  create: protectedProcedure
    .input(
      z
        .object({
          title: z.string().max(200).optional(),
          body: z.string().max(400_000).optional(),
          /** Seed a first-run script so the editor is never a blank page. */
          starter: z.boolean().optional(),
          folderId: z.string().uuid().nullish(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const viewer = ctx.viewer;

      // A script's folder always belongs to the script's owner. That is the
      // property that lets access to a folder imply access to what is listed
      // inside it, so it is checked here rather than assumed.
      if (input?.folderId) {
        await requireFolder(ctx.db, viewer, input.folderId, "owner");
      }

      const body = input?.body ?? (input?.starter ? STARTER_SCRIPT : "");
      const title =
        input?.title?.trim() ?? (body ? inferTitle(body) : "Untitled script");

      const [created] = await ctx.db
        .insert(scripts)
        .values({
          ownerId: viewer.id,
          folderId: input?.folderId ?? null,
          title: title.slice(0, 200) || "Untitled script",
          body,
          wordCount: scriptWordCount(body),
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create the script.",
        });
      }
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().max(200).optional(),
        body: z.string().max(400_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const viewer = ctx.viewer;
      const { script } = await requireScript(
        ctx.db,
        viewer,
        input.id,
        "editor",
      );

      const patch: Partial<typeof scripts.$inferInsert> = {};
      if (input.title !== undefined) {
        patch.title = input.title.trim().slice(0, 200) || "Untitled script";
      }
      if (input.body !== undefined) {
        patch.body = input.body;
        patch.wordCount = scriptWordCount(input.body);
      }
      if (Object.keys(patch).length === 0) return script;

      const [updated] = await ctx.db
        .update(scripts)
        .set(patch)
        .where(eq(scripts.id, input.id))
        .returning();

      if (input.body !== undefined) {
        await syncLiveRooms(ctx.db, updated!);
      }

      return updated!;
    }),

  /**
   * File a script somewhere else.
   *
   * Only the owner moves a script, even when somebody else may edit it: where
   * a document lives is a property of the account it belongs to, and an editor
   * rearranging your folders from inside a shared one is not editing.
   */
  move: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        folderId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const viewer = ctx.viewer;
      await requireScript(ctx.db, viewer, input.id, "owner");
      if (input.folderId) {
        await requireFolder(ctx.db, viewer, input.folderId, "owner");
      }

      const [updated] = await ctx.db
        .update(scripts)
        .set({ folderId: input.folderId })
        .where(eq(scripts.id, input.id))
        .returning();
      return updated!;
    }),

  /**
   * Take a copy.
   *
   * Reading is enough: this is how somebody with view-only access makes a
   * version they can change, and the copy is theirs outright. It lands at
   * their top level rather than in the original's folder, which may not be
   * theirs to file into.
   */
  duplicate: protectedProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const viewer = ctx.viewer;
      const { script: source } = await requireScript(
        ctx.db,
        viewer,
        input.id,
        "viewer",
      );
      const mine = source.ownerId === viewer.id;

      const [copy] = await ctx.db
        .insert(scripts)
        .values({
          ownerId: viewer.id,
          folderId: mine ? source.folderId : null,
          title: `${source.title} (copy)`.slice(0, 200),
          body: source.body,
          wordCount: source.wordCount,
        })
        .returning();
      return copy!;
    }),

  /** Only an owner deletes. An editor's mistake should not be unrecoverable. */
  remove: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const viewer = ctx.viewer;
    await requireScript(ctx.db, viewer, input.id, "owner");
    await ctx.db.delete(scripts).where(eq(scripts.id, input.id));
    return { id: input.id };
  }),
});
