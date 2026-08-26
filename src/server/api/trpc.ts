/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { viewerFor } from "~/server/library/access";
import { normaliseEmail, type Viewer } from "~/server/library/tree";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    db,
    session,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/** Logs any procedure slow enough to be worth looking at, in development. */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  const took = Date.now() - start;

  // No artificial dev latency here, unlike the create-t3-app default: a live
  // room flushes prompter state through tRPC while a take is running, and a
  // fake 100-500ms delay makes real timing problems impossible to see.
  if (t._config.isDev && took > 250) {
    console.log(`[trpc] ${path} took ${took}ms`);
  }

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    /**
     * The viewer, without asking the database for it again.
     *
     * Auth.js's database strategy resolves a session with a single statement
     * that inner-joins the user row, so by the time any procedure runs, the id
     * and the address have already been read, and the join is also what
     * proves the account still exists, because deleting a user cascades its
     * sessions away. Every procedure used to open with `viewerFor`, which
     * re-read that same row: one round trip, before any of the work the call
     * was actually for, on essentially every request in the app.
     *
     * The lookup is kept as a fallback rather than deleted. It costs nothing
     * when the session carries an address, and a session that somehow does not
     * should degrade to a slower answer rather than no answer.
     */
    const email = ctx.session.user.email;
    const viewer: Viewer = email
      ? { id: ctx.session.user.id, email: normaliseEmail(email) }
      : await viewerFor(ctx.db, ctx.session.user.id);

    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
        viewer,
      },
    });
  });
