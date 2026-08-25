"use server";

import { signIn, signOut } from "~/server/auth";
import { isEnabledProvider } from "~/server/auth/config";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/**
 * The provider id arrives from a bound server action, so it is attacker-
 * controllable in principle. Check it against the deployment's configured
 * providers before handing it to Auth.js rather than trusting the binding.
 */
export async function signInAction(providerId: string, redirectTo: string) {
  if (!isEnabledProvider(providerId)) {
    throw new Error(`Unknown sign-in provider: ${providerId}`);
  }
  const target =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/app";
  await signIn(providerId, { redirectTo: target });
}
