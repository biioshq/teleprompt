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

const max = isServerless ? 1 : env.NODE_ENV === "production" ? 10 : 4;

/**
 * How long an unused connection is kept.
 *
 * Opening one is not free: against a Supabase pooler it is a TCP connect, a
 * TLS handshake and a pooler authentication, measured here at 170-230ms, where
 * a query on an already-open connection costs 12-30ms. So a twenty-second idle
 * timeout on a long-lived server means anyone who pauses to read something and
 * then does one more thing pays an order of magnitude more for it than the
 * query is worth, and it is paid again, per connection, the first time a
 * request runs two queries at once.
 *
 * A serverless instance is a different situation and keeps the short timeout:
 * it is frozen between invocations and cannot use an idle connection anyway,
 * while every warm instance holding one multiplies against the pooler's client
 * limit. That trade-off is the reason `max` is 1 there, and it has not changed.
 */
const idle_timeout = isServerless
  ? 20
  : env.NODE_ENV === "production"
    ? 300
    : 0;

const conn =
  globalForDb.conn ??
  postgres(env.DATABASE_URL, {
    ssl: isLocal ? false : "require",
    prepare: !isTransactionPooler,
    max,
    idle_timeout,
    connect_timeout: 15,
  });

/**
 * Pay for the pool once, at startup, instead of inside the first few requests.
 *
 * Without this the pool opens lazily, so the first request pays one handshake
 * and the first request that runs a `Promise.all` pays another - which makes
 * parallelising queries look slower than doing them one at a time, exactly
 * when the connection count is still climbing. Fire-and-forget, and failures
 * are ignored on purpose: this is a warm-up, and a database that is not
 * reachable yet should surface on a real query with a real error, not as an
 * unhandled rejection at import time.
 */
if (!isServerless && !globalForDb.conn) {
  void Promise.all(
    Array.from({ length: max }, () => conn`select 1`.catch(() => undefined)),
  );
}

if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
