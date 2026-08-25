import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { SHARE_ROLES, shares, users } from "~/server/db/schema";
import {
  normaliseEmail,
  requireFolder,
  requireScript,
  viewerFor,
} from "~/server/library/access";

/**
 * Granting and revoking access.
 *
 * Only an owner may share. An editor can change the words; deciding who else
 * gets to see them is a different kind of authority, and conflating the two is
 * how a document quietly ends up somewhere its author never put it.
 *
 * Nothing here sends email. Teleprompt has no mail provider, by choice — one
 * more service, one more set of credentials, one more thing to configure
 * before a self-hosted copy works. A grant is simply waiting the next time
 * that person signs in, and the dialog says so rather than implying an
 * invitation went out.
 */

/** Exactly one of the two, which is also what the database enforces. */
const targetInput = z
  .object({
    scriptId: z.string().uuid().optional(),
    folderId: z.string().uuid().optional(),
  })
  .refine(
    (value) => Boolean(value.scriptId) !== Boolean(value.folderId),
    "Share a script or a folder, not both.",
  );

type Target = z.infer<typeof targetInput>;

const roleInput = z.enum(SHARE_ROLES);

/**
 * Deliberately permissive.
 *
 * A stricter pattern rejects addresses that are perfectly valid, and the cost
 * of a typo here is a grant that never matches anybody rather than anything
 * reaching the wrong person — an address only ever grants access to the
 * account that has already proved, to a provider, that it owns it.
 */
const emailInput = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .refine((value) => /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value), {
    message: "That does not look like an email address.",
  });

export const shareRouter = createTRPCRouter({
  /** Who this is shared with. Owner only — the list is itself information. */
  list: protectedProcedure.input(targetInput).query(async ({ ctx, input }) => {
    const viewer = await viewerFor(ctx.db, ctx.session.user.id);
    await requireTargetOwner(ctx.db, viewer, input);

    const rows = await ctx.db.query.shares.findMany({
      where: input.scriptId
        ? eq(shares.scriptId, input.scriptId)
        : eq(shares.folderId, input.folderId!),
      orderBy: [shares.email],
    });

    // Whether the address has ever signed in is worth showing: it is the
    // difference between "they have not looked yet" and "they cannot find it".
    const accounts =
      rows.length > 0
        ? await ctx.db.query.users.findMany({
            where: inArray(
              users.email,
              rows.map((row) => row.email),
            ),
            columns: { name: true, email: true, image: true },
          })
        : [];
    const byEmail = new Map(
      accounts.map((account) => [normaliseEmail(account.email), account]),
    );

    return rows.map((row) => {
      const account = byEmail.get(row.email);
      return {
        id: row.id,
        email: row.email,
        role: row.role,
        createdAt: row.createdAt,
        name: account?.name ?? null,
        image: account?.image ?? null,
        hasAccount: Boolean(account),
      };
    });
  }),

  /** Add someone, or change the level they already have. */
  grant: protectedProcedure
    .input(
      z.intersection(
        targetInput,
        z.object({ email: emailInput, role: roleInput }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const viewer = await viewerFor(ctx.db, ctx.session.user.id);
      await requireTargetOwner(ctx.db, viewer, input);

      const email = normaliseEmail(input.email);
      if (email === viewer.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already own this.",
        });
      }

      // Re-sharing with someone who is already on the list is how people
      // change a level, so it updates rather than complaining about a
      // duplicate.
      const [row] = await ctx.db
        .insert(shares)
        .values({
          ownerId: viewer.id,
          scriptId: input.scriptId ?? null,
          folderId: input.folderId ?? null,
          email,
          role: input.role,
        })
        .onConflictDoUpdate({
          target: input.scriptId
            ? [shares.scriptId, shares.email]
            : [shares.folderId, shares.email],
          set: { role: input.role, updatedAt: new Date() },
        })
        .returning();

      return row!;
    }),

  setRole: protectedProcedure
    .input(z.object({ id: z.string().uuid(), role: roleInput }))
    .mutation(async ({ ctx, input }) => {
      const viewer = await viewerFor(ctx.db, ctx.session.user.id);
      const existing = await ctx.db.query.shares.findFirst({
        where: and(eq(shares.id, input.id), eq(shares.ownerId, viewer.id)),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such share." });
      }
      const [row] = await ctx.db
        .update(shares)
        .set({ role: input.role })
        .where(eq(shares.id, input.id))
        .returning();
      return row!;
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const viewer = await viewerFor(ctx.db, ctx.session.user.id);
      const deleted = await ctx.db
        .delete(shares)
        .where(and(eq(shares.id, input.id), eq(shares.ownerId, viewer.id)))
        .returning({ id: shares.id });
      if (deleted.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such share." });
      }
      return { id: input.id };
    }),

  /**
   * Give up access somebody else granted you.
   *
   * Not the same operation as revoking: this is keyed on the recipient rather
   * than the owner, and it is the only way out of a folder you did not ask
   * for. Without it the only person who can remove something from your
   * dashboard is the person who put it there.
   */
  leave: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const viewer = await viewerFor(ctx.db, ctx.session.user.id);
      const deleted = await ctx.db
        .delete(shares)
        .where(and(eq(shares.id, input.id), eq(shares.email, viewer.email)))
        .returning({ id: shares.id });
      if (deleted.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such share." });
      }
      return { id: input.id };
    }),
});

async function requireTargetOwner(
  db: Parameters<typeof requireScript>[0],
  viewer: Parameters<typeof requireScript>[1],
  target: Target,
) {
  if (target.scriptId) {
    await requireScript(db, viewer, target.scriptId, "owner");
  } else {
    await requireFolder(db, viewer, target.folderId!, "owner");
  }
}
