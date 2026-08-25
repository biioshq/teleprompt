import { type Metadata } from "next";

import { ScriptsBoard } from "~/components/app/scripts-board";
import { requireSession } from "~/server/auth/guard";
import { api, HydrateClient } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Scripts",
  robots: { index: false },
};

export default async function AppPage() {
  await requireSession("/app");

  void api.script.list.prefetch();
  void api.room.listLive.prefetch();

  return (
    <HydrateClient>
      <ScriptsBoard />
    </HydrateClient>
  );
}
