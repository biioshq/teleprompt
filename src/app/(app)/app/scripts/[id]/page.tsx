import { type Metadata } from "next";

import { ScriptEditor } from "~/components/app/script-editor";
import { requireSession } from "~/server/auth/guard";
import { api, HydrateClient } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Editor",
  robots: { index: false },
};

export default async function ScriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSession(`/app/scripts/${id}`);

  void api.script.byId.prefetch({ id });

  return (
    <HydrateClient>
      <ScriptEditor scriptId={id} />
    </HydrateClient>
  );
}
