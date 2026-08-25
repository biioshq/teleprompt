import { type Metadata } from "next";

import { JoinForm } from "~/components/app/join-form";
import { requireSession } from "~/server/auth/guard";

export const metadata: Metadata = {
  title: "Join a room",
  description:
    "Enter the code shown on your other device to pair it with this one.",
  robots: { index: false },
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  await requireSession(code ? `/join?code=${code}` : "/join");

  return <JoinForm initialCode={code ?? ""} />;
}
