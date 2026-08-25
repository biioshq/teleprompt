import { sql } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { AUTH_PROVIDERS } from "~/server/auth/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Deployment diagnostics.
 *
 * This exists because of a genuinely nasty failure mode: Auth.js reports every
 * internal error as a generic `Configuration`, so a deployment that cannot
 * reach Postgres, or is missing `AUTH_SECRET`, or was never migrated, all show
 * the user the same sentence about provider credentials. There is nothing in
 * the browser to tell them apart, and on a serverless host the real cause is
 * buried in runtime logs.
 *
 * Everything reported here is a boolean, a count, a duration or an error code.
 * No connection string, no secret, no hostname, no stack.
 */

type Check = {
  ok: boolean;
  latencyMs?: number;
  error?: string;
  tables?: number;
  canWrite?: boolean;
};

/** Error codes carry the diagnosis; messages can carry the connection string. */
function errorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; name?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    if (typeof candidate.name === "string") return candidate.name;
  }
  return "UnknownError";
}

async function checkDatabase(): Promise<Check> {
  const startedAt = Date.now();
  try {
    // `select 1` proves connectivity; the rest distinguishes "connected but
    // never migrated" and "connected but no write privilege", which otherwise
    // look identical from the outside.
    const result = await db.execute<{
      tables: number;
      can_write: boolean;
    }>(sql`
      select
        (
          select count(*)::int
          from information_schema.tables
          where table_schema = 'public' and table_name like 'teleprompt_%'
        ) as tables,
        coalesce(
          has_table_privilege(current_user, 'public.teleprompt_user', 'INSERT'),
          false
        ) as can_write
    `);

    const row = result[0];
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      tables: row?.tables ?? 0,
      canWrite: row?.can_write ?? false,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: errorCode(error),
    };
  }
}

export async function GET() {
  const database = await checkDatabase();

  const auth = {
    secret: Boolean(env.AUTH_SECRET),
    trustHost: Boolean(process.env.AUTH_TRUST_HOST ?? process.env.VERCEL),
    providers: AUTH_PROVIDERS.filter((provider) => provider.configured).map(
      (provider) => provider.id,
    ),
  };

  const realtime = {
    url: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };

  const siteUrl = Boolean(env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL);

  // A deployment can serve pages without a database; it cannot sign anyone in.
  const ready =
    database.ok &&
    (database.tables ?? 0) >= 7 &&
    database.canWrite === true &&
    auth.secret &&
    auth.providers.length > 0 &&
    realtime.url &&
    realtime.anonKey;

  return Response.json(
    { ready, database, auth, realtime, siteUrl },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
