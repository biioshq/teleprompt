import { type Metadata } from "next";

import { LibraryBoard } from "~/components/app/library-board";
import { requireSession } from "~/server/auth/guard";
import { api, HydrateClient } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Folder",
  robots: { index: false },
};

export default async function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSession(`/app/folders/${id}`);

  void api.library.browse.prefetch({ folderId: id });

  return (
    <HydrateClient>
      <LibraryBoard folderId={id} />
    </HydrateClient>
  );
}
