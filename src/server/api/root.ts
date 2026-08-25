import { roomRouter } from "~/server/api/routers/room";
import { scriptRouter } from "~/server/api/routers/script";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  script: scriptRouter,
  room: roomRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
