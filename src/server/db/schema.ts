import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  pgTableCreator,
  primaryKey,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
// `import type`, not the inline-type form: under `verbatimModuleSyntax` the
// inline form leaves a real import of a subpath `next-auth` does not export at
// runtime. The bundler resolves it anyway, so nothing was broken, but nothing
// outside the bundler could load this file either.
import type { AdapterAccount } from "next-auth/adapters";

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
/* Folders                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A folder belongs to exactly one account and may sit inside another folder.
 *
 * The tree is walked in SQL rather than in application code; see
 * `server/library/access.ts`. Depth is bounded there rather than here: a
 * database constraint cannot express "not too deep" without a trigger, and the
 * cases that matter (a cycle, a folder moved into its own child) are prevented
 * at the point of the move, where there is something useful to say about them.
 *
 * Deleting a folder deletes the folders beneath it and un-files the scripts
 * inside, rather than deleting them. A folder is an organising idea; a script
 * is work. Losing the second because you tidied up the first would be
 * indefensible.
 */
export const folders = createTable(
  "folder",
  (d) => ({
    id: d
      .uuid()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: d
      .uuid()
      .references((): AnyPgColumn => folders.id, { onDelete: "cascade" }),
    name: d.varchar({ length: 120 }).notNull().default("New folder"),
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
    index("folder_owner_idx").on(t.ownerId),
    index("folder_parent_idx").on(t.parentId),
  ],
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
    /** Null means the account's top level, which is a real place, not a gap. */
    folderId: d.uuid().references(() => folders.id, { onDelete: "set null" }),
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
    index("script_folder_idx").on(t.folderId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Sharing                                                                    */
/* -------------------------------------------------------------------------- */

export const SHARE_ROLES = ["viewer", "editor"] as const;
export type ShareRole = (typeof SHARE_ROLES)[number];

/**
 * One grant: this address may reach this script, or this folder, at this level.
 *
 * Grants are keyed by **email address, not user id**, because the person you
 * want to share with very often does not have an account yet. Storing the
 * address means the grant is waiting for them the first time they sign in,
 * with no invitation to accept and no placeholder user to reconcile later.
 *
 * That is only safe because every address on this system is verified by the
 * identity provider before it ever reaches the database; see
 * `server/auth/config.ts`. Without that guarantee, sharing by address would be
 * sharing with whoever claimed it first.
 *
 * Addresses are stored lower-cased. Comparing them case-insensitively is not
 * strictly correct for the local part, but every provider Teleprompt accepts
 * treats it as case-insensitive, and someone typing `Ada@` for `ada@` is a far
 * more likely event than two distinct people.
 *
 * The resource is two nullable foreign keys rather than a type tag and a loose
 * id, so the database can enforce that a grant points at something real and
 * can clean the grant up when that thing is deleted. The check constraint
 * enforces exactly one of them.
 */
export const shares = createTable(
  "share",
  (d) => ({
    id: d
      .uuid()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Who granted it. Only an owner can, and only they can take it back. */
    ownerId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scriptId: d.uuid().references(() => scripts.id, { onDelete: "cascade" }),
    folderId: d.uuid().references(() => folders.id, { onDelete: "cascade" }),
    email: d.varchar({ length: 255 }).notNull(),
    role: d
      .varchar({ length: 16 })
      .$type<ShareRole>()
      .notNull()
      .default("viewer"),
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
    // Postgres treats NULLs as distinct in a unique index, which is exactly
    // right here: these two constraints do not interfere with each other.
    unique("share_script_email_unique").on(t.scriptId, t.email),
    unique("share_folder_email_unique").on(t.folderId, t.email),
    index("share_email_idx").on(t.email),
    index("share_owner_idx").on(t.ownerId),
    check(
      "share_one_resource",
      sql`(${t.scriptId} IS NULL) <> (${t.folderId} IS NULL)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Rooms: one live teleprompter session shared by an account's devices        */
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
     * account; see `docs/architecture`.
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
    // Rooms are ended, never deleted, so this table only grows. Two hot paths
    // look a room up by the script behind it - the editor's autosave, which
    // pushes every edit into whatever room is showing that script, and the
    // button that offers an existing room rather than opening a second one -
    // and without this both of them read every room the deployment has ever
    // opened to find the handful that matter.
    index("room_script_idx").on(t.scriptId),
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
  folders: many(folders),
  rooms: many(rooms),
  shares: many(shares),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  owner: one(users, { fields: [folders.ownerId], references: [users.id] }),
  parent: one(folders, {
    relationName: "folderTree",
    fields: [folders.parentId],
    references: [folders.id],
  }),
  children: many(folders, { relationName: "folderTree" }),
  scripts: many(scripts),
  shares: many(shares),
}));

export const sharesRelations = relations(shares, ({ one }) => ({
  owner: one(users, { fields: [shares.ownerId], references: [users.id] }),
  script: one(scripts, {
    fields: [shares.scriptId],
    references: [scripts.id],
  }),
  folder: one(folders, {
    fields: [shares.folderId],
    references: [folders.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  owner: one(users, { fields: [scripts.ownerId], references: [users.id] }),
  folder: one(folders, {
    fields: [scripts.folderId],
    references: [folders.id],
  }),
  rooms: many(rooms),
  shares: many(shares),
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

export type Folder = typeof folders.$inferSelect;
export type Share = typeof shares.$inferSelect;
export type Script = typeof scripts.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type RoomDevice = typeof roomDevices.$inferSelect;
