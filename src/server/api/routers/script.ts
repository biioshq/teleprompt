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
import { db as database } from "~/server/db";
import { rooms, scripts } from "~/server/db/schema";

type Db = typeof database;
type Script = typeof scripts.$inferSelect;

const idInput = z.object({ id: z.string().uuid() });

const STARTER_SCRIPT = `# Welcome to Teleprompt

Open this script on the device your audience sees, then open the remote on your
phone. Both screens hold the same words, and the phone decides which words.

:: breathe, look at the lens

## What to try first

- Press play on the remote and watch this screen move.
- Slide the speed control — the pace follows you instantly.
- Tap a line on the remote to jump the display straight to it.

Anything you can write in Markdown works here. Headings break a script into
sections, lists give you one beat per bullet, and a line that begins with two
colons becomes a cue: visible to you, never read aloud.

:: pause here, then land the closing line

That is the whole product. Write, connect, present.
`;

async function requireScript(db: Db, id: string, ownerId: string) {
  const script = await db.query.scripts.findFirst({
    where: and(eq(scripts.id, id), eq(scripts.ownerId, ownerId)),
  });
  if (!script) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That script does not exist, or is not yours.",
    });
  }
  return script;
}

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
 */
async function syncLiveRooms(db: Db, script: Script, ownerId: string) {
  const live = await db.query.rooms.findMany({
    where: and(
      eq(rooms.scriptId, script.id),
      eq(rooms.ownerId, ownerId),
      eq(rooms.status, "live"),
    ),
  });
  if (live.length === 0) return;

  const blockCount = splitIntoBlocks(script.body).length;
  const lastBlock = Math.max(0, blockCount - 1);

  for (const room of live) {
    if (room.content === script.body && room.title === script.title) continue;

    const current = parseState(room.state);
    const blockIndex = Math.min(current.anchor.blockIndex, lastBlock);
    const keptExactly = blockIndex === current.anchor.blockIndex;

    await db
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
        lastActiveAt: new Date(),
      })
      .where(eq(rooms.id, room.id));
  }
}

export const scriptRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.scripts.findMany({
      where: eq(scripts.ownerId, ctx.session.user.id),
      orderBy: [desc(scripts.updatedAt)],
      limit: 200,
    });
  }),

  byId: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
    return requireScript(ctx.db, input.id, ctx.session.user.id);
  }),

  create: protectedProcedure
    .input(
      z
        .object({
          title: z.string().max(200).optional(),
          body: z.string().max(400_000).optional(),
          /** Seed a first-run script so the editor is never a blank page. */
          starter: z.boolean().optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const body = input?.body ?? (input?.starter ? STARTER_SCRIPT : "");
      const title =
        input?.title?.trim() ?? (body ? inferTitle(body) : "Untitled script");

      const [created] = await ctx.db
        .insert(scripts)
        .values({
          ownerId: ctx.session.user.id,
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
      await requireScript(ctx.db, input.id, ctx.session.user.id);

      const patch: Partial<typeof scripts.$inferInsert> = {};
      if (input.title !== undefined) {
        patch.title = input.title.trim().slice(0, 200) || "Untitled script";
      }
      if (input.body !== undefined) {
        patch.body = input.body;
        patch.wordCount = scriptWordCount(input.body);
      }
      if (Object.keys(patch).length === 0) {
        return requireScript(ctx.db, input.id, ctx.session.user.id);
      }

      const [updated] = await ctx.db
        .update(scripts)
        .set(patch)
        .where(
          and(
            eq(scripts.id, input.id),
            eq(scripts.ownerId, ctx.session.user.id),
          ),
        )
        .returning();

      if (input.body !== undefined) {
        await syncLiveRooms(ctx.db, updated!, ctx.session.user.id);
      }

      return updated!;
    }),

  duplicate: protectedProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const source = await requireScript(ctx.db, input.id, ctx.session.user.id);
      const [copy] = await ctx.db
        .insert(scripts)
        .values({
          ownerId: ctx.session.user.id,
          title: `${source.title} (copy)`.slice(0, 200),
          body: source.body,
          wordCount: source.wordCount,
        })
        .returning();
      return copy!;
    }),

  remove: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    await requireScript(ctx.db, input.id, ctx.session.user.id);
    await ctx.db
      .delete(scripts)
      .where(
        and(eq(scripts.id, input.id), eq(scripts.ownerId, ctx.session.user.id)),
      );
    return { id: input.id };
  }),
});
