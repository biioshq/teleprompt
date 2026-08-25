import { type Config } from "drizzle-kit";

import { env } from "~/env";

export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  // Every table this project owns is prefixed, so Drizzle leaves the rest of
  // the Supabase database (auth, storage, realtime schemas) alone.
  tablesFilter: ["teleprompt_*"],
} satisfies Config;
