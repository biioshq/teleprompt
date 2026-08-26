import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * `AUTH_SECRET` is genuinely load-bearing (without it, sessions are not
 * signed), so it is mandatory in production.
 */
const requiredInProduction =
  process.env.NODE_ENV === "production" ? z.string() : z.string().optional();

export const env = createEnv({
  server: {
    AUTH_SECRET: requiredInProduction,
    /**
     * Provider credentials stay optional at every stage, and each provider is
     * independent: configure one, both, or neither. A fresh clone must be able
     * to install, build and boot before its owner has been near either
     * console, and the sign-in page names whatever is missing.
     */
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    AUTH_GITHUB_ID: z.string().optional(),
    AUTH_GITHUB_SECRET: z.string().optional(),
    DATABASE_URL: z.string().url(),
    /**
     * Optional. A session-mode connection, used only by the Drizzle CLI.
     *
     * The app wants the transaction pooler; `drizzle-kit` cannot use it. See
     * the comment in `drizzle.config.ts`. If that file's automatic
     * substitution does not fit your setup, set this and it wins.
     */
    DIRECT_DATABASE_URL: z.string().url().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    /**
     * Populated by Vercel at build and run time; a bare hostname with no
     * scheme, and always the production domain even on a preview deployment.
     * Off Vercel, set it by hand to your own domain. Read through
     * `getSiteUrl()` in `~/lib/url`, never directly.
     */
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  },

  /**
   * You can't destructure `process.env` in the Next.js edge runtime or on the
   * client, so the mapping is written out by hand.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
