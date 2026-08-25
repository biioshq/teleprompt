import { type Metadata, type Viewport } from "next";

import { RemoteClient } from "~/components/prompter/remote-client";
import { requireSession } from "~/server/auth/guard";

export const metadata: Metadata = {
  title: "Remote",
  robots: { index: false },
};

/**
 * The stage paints itself black, so the strip iOS reserves for the status bar
 * should be black too. Without this it inherits the app-wide paper colour and
 * a cream band appears above a dark screen.
 */
export const viewport: Viewport = {
  themeColor: "#0b0b0c",
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
