import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { inferTitle, scriptWordCount } from "~/lib/markdown/blocks";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db as database } from "~/server/db";
import { scripts } from "~/server/db/schema";

type Db = typeof database;

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
