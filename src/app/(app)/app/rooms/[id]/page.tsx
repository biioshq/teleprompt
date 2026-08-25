import { type Metadata } from "next";

import { RoomLobby } from "~/components/app/room-lobby";
import { requireSession } from "~/server/auth/guard";
import { api, HydrateClient } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Room",
  robots: { index: false },
};

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSession(`/app/rooms/${id}`);

  void api.room.byId.prefetch({ id });

  return (
    <HydrateClient>
      <RoomLobby roomId={id} />
    </HydrateClient>
  );
}
