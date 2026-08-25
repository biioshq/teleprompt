import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { browse, sharedRoots, viewerFor } from "~/server/library/access";

/**
 * What the dashboard reads.
 *
 * One call per view rather than a folder query and a script query and a
 * permission query stitched together on the client: the answer to "what may I
 * see here" is a single decision made on the server, and splitting it up is
 * how a client ends up rendering a folder it turns out it cannot open.
 */
export const libraryRouter = createTRPCRouter({
  browse: protectedProcedure
    .input(z.object({ folderId: z.string().uuid().nullable() }))
    .query(async ({ ctx, input }) => {
      const viewer = await viewerFor(ctx.db, ctx.session.user.id);
      return browse(ctx.db, viewer, input.folderId);
    }),

  /** Only what other people shared, and only the roots of it. */
  sharedWithMe: protectedProcedure.query(async ({ ctx }) => {
    const viewer = await viewerFor(ctx.db, ctx.session.user.id);
    return sharedRoots(ctx.db, viewer);
  }),
});
