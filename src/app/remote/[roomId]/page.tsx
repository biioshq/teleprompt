import { type Metadata } from "next";

import { RemoteClient } from "~/components/prompter/remote-client";
import { requireSession } from "~/server/auth/guard";

export const metadata: Metadata = {
  title: "Remote",
  robots: { index: false },
};

export default async function RemotePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  await requireSession(`/remote/${roomId}`);

  return <RemoteClient roomId={roomId} />;
}
