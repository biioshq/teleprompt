import { folderRouter } from "~/server/api/routers/folder";
import { libraryRouter } from "~/server/api/routers/library";
import { roomRouter } from "~/server/api/routers/room";
import { scriptRouter } from "~/server/api/routers/script";
import { shareRouter } from "~/server/api/routers/share";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  script: scriptRouter,
  folder: folderRouter,
  share: shareRouter,
  library: libraryRouter,
  room: roomRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
