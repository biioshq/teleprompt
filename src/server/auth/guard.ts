import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

/**
 * Server-side gate for every signed-in surface. Sends people to sign-in with
 * a `next` parameter so they land back where they were aiming — which matters
 * a lot when the link they opened was a room on a second device.
 */
export async function requireSession(nextPath: string) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}
