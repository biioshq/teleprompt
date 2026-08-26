import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { folders, scripts } from "~/server/db/schema";
import {
  MAX_DEPTH,
  ancestorChain,
  depthOf,
  loadFolders,
  requireFolder,
  subtreeHeight,
  withDescendants,
} from "~/server/library/access";

/**
 * Folders are structural, and structure belongs to the account that owns it.
 *
 * Someone with editing rights on a shared folder can change the scripts inside
 * it; they cannot rename it, move it, or add folders to it. That line is not
 * timidity, it is what keeps the model coherent: a script's folder always
 * belongs to the script's owner, which is the property that lets access to a
 * folder imply access to everything listed in it. Allowing a collaborator to
 * file their own work inside your folder would break it, and the failure would
 * show up as a script you can see the name of and cannot open.
 */

const nameInput = z.string().trim().min(1, "A folder needs a name.").max(120);

export const folderRouter = createTRPCRouter({
  /** Every folder on the account, for breadcrumbs and the move picker. */
  tree: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.folders.findMany({
      where: eq(folders.ownerId, ctx.session.user.id),
      orderBy: [folders.name],
    });
    return rows;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: nameInput.optional(),
        parentId: z.string().uuid().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const viewer = ctx.viewer;

      if (input.parentId) {
        await requireFolder(ctx.db, viewer, input.parentId, "owner");
        const map = await loadFolders(ctx.db, [viewer.id]);
        if (depthOf(map, input.parentId) + 1 > MAX_DEPTH) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Folders can be ${MAX_DEPTH} deep. This one is already at the limit.`,
          });
        }
      }

      const [created] = await ctx.db
        .insert(folders)
        .values({
          ownerId: viewer.id,
          parentId: input.parentId ?? null,
          name: input.name ?? "New folder",
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create the folder.",
        });
      }
      return created;
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: nameInput }))
    .mutation(async ({ ctx, input }) => {
      const viewer = ctx.viewer;
      await requireFolder(ctx.db, viewer, input.id, "owner");

      const [updated] = await ctx.db
        .update(folders)
        .set({ name: input.name })
        .where(eq(folders.id, input.id))
        .returning();
      return updated!;
    }),

  move: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        parentId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const viewer = ctx.viewer;
      await requireFolder(ctx.db, viewer, input.id, "owner");

      if (input.parentId === input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A folder cannot be inside itself.",
        });
      }

      const map = await loadFolders(ctx.db, [viewer.id]);

      if (input.parentId) {
        await requireFolder(ctx.db, viewer, input.parentId, "owner");

        // Moving a folder into its own descendant would detach the whole
        // subtree from the tree and leave it circling. The database cannot
        // refuse this; nothing but this check stands between it and a folder
        // that exists but can never be reached.
        const inside = ancestorChain(map, input.parentId).some(
          (step) => step.id === input.id,
        );
        if (inside) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A folder cannot be moved inside one of its own folders.",
          });
        }

        const height = subtreeHeight(map, input.id);
        if (depthOf(map, input.parentId) + height > MAX_DEPTH) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `That would nest folders more than ${MAX_DEPTH} deep.`,
          });
        }
      }

      const [updated] = await ctx.db
        .update(folders)
        .set({ parentId: input.parentId })
        .where(eq(folders.id, input.id))
        .returning();
      return updated!;
    }),

  /**
   * Delete a folder and the folders inside it. Scripts are never deleted;
   * they come back to the top level, where they can be found again.
   */
  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const viewer = ctx.viewer;
      await requireFolder(ctx.db, viewer, input.id, "owner");

      // The database cascade would take the subfolders and set every script's
      // folder to null on its own, which is the behaviour we want. Doing the
      // un-filing explicitly first means the scripts land at the top level
      // rather than being briefly orphaned inside a folder being deleted.
      const map = await loadFolders(ctx.db, [viewer.id]);
      const doomed = [...withDescendants(map, [input.id])];

      await ctx.db.transaction(async (tx) => {
        for (const folderId of doomed) {
          await tx
            .update(scripts)
            .set({ folderId: null })
            .where(
              and(
                eq(scripts.folderId, folderId),
                eq(scripts.ownerId, viewer.id),
              ),
            );
        }
        await tx.delete(folders).where(eq(folders.id, input.id));
      });

      return { id: input.id, unfiled: doomed.length };
    }),
});
