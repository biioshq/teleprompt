import { relations, sql } from "drizzle-orm";
import { index, pgTableCreator, primaryKey, unique } from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

import {
  DEFAULT_PROMPTER_STATE,
  type PrompterState,
} from "~/lib/prompter/state";

/**
 * Every table Teleprompt owns is prefixed, so the app can live inside a shared
 * Supabase project without colliding with anything else in the `public` schema.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `teleprompt_${name}`);

/* -------------------------------------------------------------------------- */
/* Auth.js                                                                    */
/* -------------------------------------------------------------------------- */

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({ mode: "date", withTimezone: true })
    .$defaultFn(() => new Date()),
  image: d.varchar({ length: 512 }),
  createdAt: d
    .timestamp({ withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
    /**
     * GitHub Apps with expiring tokens also return `refresh_token_expires_in`.
     * There is deliberately no column for it: Drizzle drops keys that have no
     * column, and Teleprompt never touches a provider token after sign-in - it
     * only ever needed the identity behind it.
     */
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* -------------------------------------------------------------------------- */
/* Scripts                                                                    */
/* -------------------------------------------------------------------------- */

export const scripts = createTable(
  "script",
  (d) => ({
    id: d
      .uuid()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: d.varchar({ length: 200 }).notNull().default("Untitled script"),
    body: d.text().notNull().default(""),
    /** Cached so the dashboard can show a read-time without parsing bodies. */
    wordCount: d.integer().notNull().default(0),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
  }),
  (t) => [
    index("script_owner_idx").on(t.ownerId),
    index("script_owner_updated_idx").on(t.ownerId, t.updatedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Rooms — one live teleprompter session shared by an account's devices        */
/* -------------------------------------------------------------------------- */

export const rooms = createTable(
  "room",
  (d) => ({
    id: d
      .uuid()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scriptId: d.uuid().references(() => scripts.id, { onDelete: "set null" }),

    /** Human-typeable join code, e.g. `K7M-2QF`. Unique among live rooms. */
    code: d.varchar({ length: 16 }).notNull(),

    /**
     * High-entropy secret that names the Realtime channel and gates the
     * WebRTC signalling. Only handed to signed-in devices on the owning
     * account — see `docs/architecture`.
     */
    channelKey: d.varchar({ length: 64 }).notNull(),

    /**
     * Snapshot of the script at the moment the room opened. Both devices must
     * render byte-identical text for block indices to line up, so edits are
     * pulled in explicitly rather than streaming in mid-take.
     */
    title: d.varchar({ length: 200 }).notNull().default("Untitled script"),
    content: d.text().notNull().default(""),
    contentRevision: d.integer().notNull().default(1),

    state: d
      .jsonb()
      .$type<PrompterState>()
      .notNull()
      .$defaultFn(() => DEFAULT_PROMPTER_STATE),

    status: d
      .varchar({ length: 16 })
      .$type<"live" | "ended">()
      .notNull()
      .default("live"),

    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
    lastActiveAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    endedAt: d.timestamp({ withTimezone: true }),
  }),
  (t) => [
    unique("room_channel_key_unique").on(t.channelKey),
    index("room_owner_idx").on(t.ownerId),
    index("room_code_idx").on(t.code),
    index("room_status_idx").on(t.status),
  ],
);

/* -------------------------------------------------------------------------- */
/* Devices attached to a room                                                 */
/* -------------------------------------------------------------------------- */

export const roomDevices = createTable(
  "room_device",
  (d) => ({
    id: d
      .uuid()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    roomId: d
      .uuid()
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** Stable per-browser id, also used as the Realtime presence key. */
    deviceKey: d.varchar({ length: 64 }).notNull(),
    role: d
      .varchar({ length: 16 })
      .$type<"prompter" | "remote">()
      .notNull()
      .default("remote"),
    label: d.varchar({ length: 80 }).notNull().default("Device"),
    platform: d.varchar({ length: 160 }),

    joinedAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastSeenAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    unique("room_device_unique").on(t.roomId, t.deviceKey),
    index("room_device_room_idx").on(t.roomId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  scripts: many(scripts),
  rooms: many(rooms),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  owner: one(users, { fields: [scripts.ownerId], references: [users.id] }),
  rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  owner: one(users, { fields: [rooms.ownerId], references: [users.id] }),
  script: one(scripts, { fields: [rooms.scriptId], references: [scripts.id] }),
  devices: many(roomDevices),
}));

export const roomDevicesRelations = relations(roomDevices, ({ one }) => ({
  room: one(rooms, { fields: [roomDevices.roomId], references: [rooms.id] }),
  user: one(users, { fields: [roomDevices.userId], references: [users.id] }),
}));

export type Script = typeof scripts.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type RoomDevice = typeof roomDevices.$inferSelect;
