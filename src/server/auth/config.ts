import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { type Provider } from "next-auth/providers";

import { env } from "~/env";
import { db } from "~/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

/* -------------------------------------------------------------------------- */
/* Which providers this deployment actually has credentials for               */
/* -------------------------------------------------------------------------- */

export const AUTH_PROVIDERS = [
  {
    id: "google",
    label: "Google",
    configured: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    variables: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
    console: "https://console.cloud.google.com/apis/credentials",
  },
  {
    id: "github",
    label: "GitHub",
    configured: Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET),
    variables: ["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"],
    console: "https://github.com/settings/developers",
  },
] as const;

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]["id"];

export const enabledProviderIds = AUTH_PROVIDERS.filter(
  (provider) => provider.configured,
).map((provider) => provider.id);

export const hasAnyProvider = enabledProviderIds.length > 0;

export function isEnabledProvider(value: string): value is AuthProviderId {
  return (enabledProviderIds as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* GitHub, with the email actually verified                                   */
/* -------------------------------------------------------------------------- */

type GitHubEmail = { email: string; primary: boolean; verified: boolean };

/**
 * Auth.js's stock GitHub provider takes the primary address from
 * `/user/emails` **without checking `verified`**. That is fine when GitHub is
 * your only provider, but Teleprompt links accounts by email address, so an
 * unverified address would be a way into somebody else's account.
 *
 * This override only ever accepts an address GitHub says is verified, and
 * returns none at all if there isn't one. `signIn` below turns that into a
 * readable refusal rather than a failed insert.
 */
async function githubUserinfo(accessToken: string) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "teleprompt",
  };

  const profile = (await fetch("https://api.github.com/user", {
    headers,
  }).then((response) => response.json())) as Record<string, unknown>;

  const response = await fetch("https://api.github.com/user/emails", {
    headers,
  });
  const emails: GitHubEmail[] = response.ok
    ? ((await response.json()) as GitHubEmail[])
    : [];

  const verified =
    emails.find((entry) => entry.primary && entry.verified) ??
    emails.find((entry) => entry.verified);

  profile.email = verified?.email ?? null;
  return profile;
}

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const providers: Provider[] = [];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: { params: { prompt: "select_account" } },
      // See the note on linking below.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
      userinfo: {
        url: "https://api.github.com/user",
        async request({ tokens }: { tokens: { access_token?: string } }) {
          return githubUserinfo(tokens.access_token ?? "");
        },
      },
    }),
  );
}

export const authConfig = {
  providers,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    /**
     * Teleprompt defines a room as "the devices signed in as one account", so
     * a person who uses Google on their laptop and GitHub on their phone must
     * end up in one account, not two. Two accounts would not produce an error
     * message: the join code would simply never resolve, which is the worst
     * possible failure for this product.
     *
     * Hence `allowDangerousEmailAccountLinking` on both providers. The
     * "dangerous" part of that flag is providers that hand back addresses they
     * have not verified, so the guard is here: an unverified address never gets
     * as far as the adapter, from either provider.
     */
    signIn({ account, profile }) {
      if (!account) return false;

      const email = profile?.email;
      if (!email) return "/signin?error=NoVerifiedEmail";

      if (account.provider === "google") {
        const verified = (profile as { email_verified?: boolean })
          .email_verified;
        // Google omits the claim only in unusual Workspace setups; treat an
        // explicit `false` as a refusal and anything else as fine.
        if (verified === false) return "/signin?error=NoVerifiedEmail";
      }

      // GitHub addresses are filtered in `githubUserinfo` above, so anything
      // that reaches here already carries a verified address.
      return true;
    },

    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
} satisfies NextAuthConfig;
