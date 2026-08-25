import { type Metadata } from "next";

import { PrompterClient } from "~/components/prompter/prompter-client";
import { requireSession } from "~/server/auth/guard";

export const metadata: Metadata = {
  title: "Display",
  robots: { index: false },
};

export default async function PrompterPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  await requireSession(`/prompter/${roomId}`);

  return <PrompterClient roomId={roomId} />;
}
