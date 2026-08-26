import { type Config } from "drizzle-kit";

import { env } from "~/env";

/**
 * The CLI needs a different connection from the app.
 *
 * Supabase's transaction pooler on 6543 is the right choice for the app: a
 * serverless function opens a connection, runs one statement and lets go, and
 * that is exactly what transaction mode is for. It is the wrong choice for
 * `drizzle-kit`, which introspects the database by firing a burst of small
 * per-table queries and, on that pooler, gets some of the answers back matched
 * to the wrong question. The symptom is not a helpful error:
 *
 *     TypeError: Cannot read properties of undefined (reading 'replace')
 *         at .../drizzle-kit/bin.cjs:19401
 *
 * That is the check-constraint reader being handed a row from the foreign-key
 * query, which has no definition column. It only becomes fatal once the schema
 * contains a single CHECK constraint anywhere, because until then that loop
 * never runs, so it appears the day you add one and looks like your fault.
 *
 * Session mode on 5432 keeps one connection for the whole run and the answers
 * stay with their questions. Same host, same credentials, same database; only
 * the port differs, so the substitution below is safe. A direct
 * `db.<ref>.supabase.co` host and a local Postgres are already on 5432 and are
 * left alone.
 *
 * Set `DIRECT_DATABASE_URL` to override this entirely.
 */
function cliUrl(): string {
  if (env.DIRECT_DATABASE_URL) return env.DIRECT_DATABASE_URL;
  return env.DATABASE_URL.replace(
    /(\.pooler\.supabase\.com):6543\b/,
    "$1:5432",
  );
}

export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: cliUrl(),
  },
  // Every table this project owns is prefixed, so Drizzle leaves the rest of
  // the Supabase database (auth, storage, realtime schemas) alone.
  tablesFilter: ["teleprompt_*"],
} satisfies Config;
