import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import * as schema from "./schema";

/**
 * Cached across HMR reloads in development, so editing a router does not open
 * a new pool on every save.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const isLocal = /(?:localhost|127\.0\.0\.1)/.test(env.DATABASE_URL);

/**
 * Supabase's transaction pooler (port 6543) multiplexes connections and cannot
 * hold server-side prepared statements. Detecting it here means the same URL
 * works whether you point at the direct endpoint, the session pooler or the
 * transaction pooler.
 *
 * Worth knowing, because it is not obvious from any error message: the direct
 * `db.<ref>.supabase.co` endpoint resolves to an **IPv6 address only**. Hosts
 * without IPv6 egress - Vercel's functions among them - cannot reach it at all,
 * and the failure surfaces at the top of the stack as an Auth.js
 * `Configuration` error rather than anything mentioning the database. Use a
 * pooler hostname in production; it has A records.
 */
const isTransactionPooler =
  env.DATABASE_URL.includes("pooler.supabase.com:6543") ||
  env.DATABASE_URL.includes(":6543/");

/**
 * On a serverless platform every warm instance holds its own pool, so a
 * generous `max` multiplies by the number of instances and exhausts the
 * pooler's client limit. One connection per instance is the shape that
 * platform expects.
 */
const isServerless = Boolean(
  process.env.VERCEL ?? process.env.AWS_LAMBDA_FUNCTION_NAME,
);

const conn =
  globalForDb.conn ??
  postgres(env.DATABASE_URL, {
    ssl: isLocal ? false : "require",
    prepare: !isTransactionPooler,
    max: isServerless ? 1 : env.NODE_ENV === "production" ? 10 : 4,
    idle_timeout: 20,
    connect_timeout: 15,
  });

if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
