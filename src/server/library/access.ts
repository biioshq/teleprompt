import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Type-only: naming the client's type must not drag the client itself (and its
// connection pool, and its environment validation) into every module that
// mentions a query.
import type { db as database } from "~/server/db";
import { folders, scripts, shares, users } from "~/server/db/schema";
import type { Folder, Script, Share } from "~/server/db/schema";
import {
  allows,
  ancestorChain,
  groupByFolder,
  normaliseEmail,
  resolveFolderAccess,
  resolveScriptAccess,
  keepStronger,
  stronger,
  withDescendants,
  type Access,
  type FolderMap,
  type Grant,
  type Grants,
  type Viewer,
} from "~/server/library/tree";

/** Re-exported so callers have one place to import the library's vocabulary. */
export {
  allows,
  ancestorChain,
  childrenMap,
  groupByFolder,
  depthOf,
  normaliseEmail,
  resolveFolderAccess,
  resolveScriptAccess,
  subtreeHeight,
  withDescendants,
  MAX_DEPTH,
  type Access,
  type FolderMap,
  type Grant,
  type Grants,
  type Viewer,
} from "~/server/library/tree";

/**
 * Who may reach what.
 *
 * Every read and write in the library funnels through this file, so that the
 * question "is this person allowed to do this" has exactly one answer and one
 * place to be wrong. The routers ask; they never work it out themselves.
 */

type Db = typeof database;

export async function viewerFor(db: Db, userId: string): Promise<Viewer> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true },
  });
  if (!row) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Unknown account." });
  }
  return { id: row.id, email: normaliseEmail(row.email) };
}

export async function loadFolders(
  db: Db,
  ownerIds: string[],
): Promise<FolderMap> {
  const unique = [...new Set(ownerIds)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await db.query.folders.findMany({
    where: inArray(folders.ownerId, unique),
  });
  return new Map(rows.map((folder) => [folder.id, folder]));
}

export async function grantsFor(db: Db, viewer: Viewer): Promise<Grants> {
  const rows = await db.query.shares.findMany({
    where: eq(shares.email, viewer.email),
  });

  const folderRoots = new Map<string, Grant>();
  const scriptGrants = new Map<string, Grant>();
  const ownerIds = new Set<string>();

  for (const row of rows) {
    // A grant to yourself is meaningless and is refused when it is made; if
    // one exists anyway it must not be able to weaken ownership.
    if (row.ownerId === viewer.id) continue;
    ownerIds.add(row.ownerId);
    const grant: Grant = { role: row.role, shareId: row.id };
    if (row.folderId) keepStronger(folderRoots, row.folderId, grant);
    else if (row.scriptId) keepStronger(scriptGrants, row.scriptId, grant);
  }

  return { folderRoots, scriptGrants, ownerIds: [...ownerIds] };
}

/* -------------------------------------------------------------------------- */
/* Access to one thing                                                        */
/* -------------------------------------------------------------------------- */

export async function scriptAccess(
  db: Db,
  viewer: Viewer,
  script: Script,
): Promise<Access | null> {
  if (script.ownerId === viewer.id) return "owner";

  const grants = await grantsFor(db, viewer);
  // The tree is only needed when a folder grant could possibly apply.
  const map =
    script.folderId && grants.folderRoots.size > 0
      ? await loadFolders(db, [script.ownerId])
      : new Map<string, Folder>();

  return resolveScriptAccess(viewer, script, grants, map);
}

export async function folderAccess(
  db: Db,
  viewer: Viewer,
  folder: Folder,
): Promise<Access | null> {
  if (folder.ownerId === viewer.id) return "owner";

  const grants = await grantsFor(db, viewer);
  if (grants.folderRoots.size === 0) return null;

  const map = await loadFolders(db, [folder.ownerId]);
  return resolveFolderAccess(viewer, folder, grants, map);
}

/* -------------------------------------------------------------------------- */
/* Gates                                                                      */
/* -------------------------------------------------------------------------- */

const DENIED = {
  script:
    "That script does not exist, or has not been shared with this account.",
  folder:
    "That folder does not exist, or has not been shared with this account.",
} as const;

/**
 * Missing and forbidden are deliberately the same answer.
 *
 * Telling someone that a script exists but is not theirs turns any id into a
 * probe for whether a document exists. There is nothing here worth that.
 */
export async function requireScript(
  db: Db,
  viewer: Viewer,
  id: string,
  minimum: Access,
): Promise<{ script: Script; access: Access }> {
  const script = await db.query.scripts.findFirst({
    where: eq(scripts.id, id),
  });
  const access = script ? await scriptAccess(db, viewer, script) : null;
  if (!script || !allows(access, minimum)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message:
        access && minimum === "editor"
          ? "You have view-only access to this script."
          : DENIED.script,
    });
  }
  return { script, access: access! };
}

export async function requireFolder(
  db: Db,
  viewer: Viewer,
  id: string,
  minimum: Access,
): Promise<{ folder: Folder; access: Access }> {
  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, id),
  });
  const access = folder ? await folderAccess(db, viewer, folder) : null;
  if (!folder || !allows(access, minimum)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message:
        access && minimum === "editor"
          ? "You have view-only access to this folder."
          : DENIED.folder,
    });
  }
  return { folder, access: access! };
}

/* -------------------------------------------------------------------------- */
/* Grants made further up                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The grants sitting on the folders above something, nearest folder first.
 *
 * A grant on a folder reaches everything filed under it, however deep, and
 * from the thing itself that is invisible: a script's own share list can be
 * empty while three people are reading it. Anything that answers "who can see
 * this" has to ask this question too, so it is asked in one place.
 *
 * `parentFolderId` is the folder the thing sits *in*: a script's `folderId`,
 * a folder's `parentId`, or the folder itself when the question is about its
 * children. Pass `map` when the owner's tree is already loaded.
 */
export async function inheritedShares(
  db: Db,
  ownerId: string,
  parentFolderId: string | null,
  map?: FolderMap,
): Promise<Array<{ folder: Folder; rows: Share[] }>> {
  if (!parentFolderId) return [];

  const chain = ancestorChain(
    map ?? (await loadFolders(db, [ownerId])),
    parentFolderId,
  );
  if (chain.length === 0) return [];

  const rows = await db.query.shares.findMany({
    where: and(
      eq(shares.ownerId, ownerId),
      inArray(
        shares.folderId,
        chain.map((folder) => folder.id),
      ),
    ),
    orderBy: [shares.email],
  });

  return groupByFolder(chain, rows);
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                    */
/* -------------------------------------------------------------------------- */

export type LibraryEntry = {
  access: Access;
  /** Set when the thing belongs to somebody else. */
  ownerName: string | null;
  ownerEmail: string | null;
  /** The grant that reaches it, when it is somebody else's and shared directly. */
  shareId: string | null;
  /** How many people it is shared with. Only ever filled in for an owner. */
  sharedCount: number;
};

/**
 * How many people can see each of a set of things.
 *
 * Shown on the card, because "who can see this" is the question sharing
 * creates and the worst answer is having to open each one to find out.
 *
 * People, not grants: an address reached both directly and through a folder
 * above is one person, and counting the rows would say two. `inherited` is
 * every address a grant further up already reaches, which is the same set for
 * everything in one folder; they are all the same distance below it.
 */
async function shareCounts(
  db: Db,
  folderIds: string[],
  scriptIds: string[],
  inherited: ReadonlySet<string> = new Set(),
): Promise<Map<string, number>> {
  const ids = [...folderIds, ...scriptIds];
  if (ids.length === 0) return new Map();

  const rows = await db.query.shares.findMany({
    where: or(
      folderIds.length > 0 ? inArray(shares.folderId, folderIds) : undefined,
      scriptIds.length > 0 ? inArray(shares.scriptId, scriptIds) : undefined,
    ),
    columns: { folderId: true, scriptId: true, email: true },
  });

  const direct = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = row.folderId ?? row.scriptId;
    if (!key) continue;
    const set = direct.get(key) ?? new Set<string>();
    set.add(row.email);
    direct.set(key, set);
  }

  const counts = new Map<string, number>();
  for (const id of ids) {
    const own = direct.get(id);
    if (!own) {
      counts.set(id, inherited.size);
      continue;
    }
    let total = own.size;
    for (const email of inherited) if (!own.has(email)) total += 1;
    counts.set(id, total);
  }
  return counts;
}

/**
 * The contents of one folder, or of the account's top level.
 *
 * `folderId === null` means the viewer's own top level. Somebody else's top
 * level is not a place you can be: what is shared with you is a folder or a
 * script, never an account.
 */
export async function browse(
  db: Db,
  viewer: Viewer,
  folderId: string | null,
): Promise<{
  folder: Folder | null;
  access: Access;
  /** Whose folder this is, when it is not the viewer's. */
  ownerName: string | null;
  ownerEmail: string | null;
  breadcrumb: Folder[];
  folders: Array<Folder & LibraryEntry>;
  scripts: Array<Script & LibraryEntry>;
}> {
  if (folderId === null) {
    const [ownFolders, ownScripts] = await Promise.all([
      db.query.folders.findMany({
        where: and(eq(folders.ownerId, viewer.id), isNull(folders.parentId)),
        orderBy: [folders.name],
      }),
      db.query.scripts.findMany({
        where: and(eq(scripts.ownerId, viewer.id), isNull(scripts.folderId)),
        orderBy: [desc(scripts.updatedAt)],
        limit: 200,
      }),
    ]);

    const counts = await shareCounts(
      db,
      ownFolders.map((row) => row.id),
      ownScripts.map((row) => row.id),
    );

    return {
      folder: null,
      access: "owner",
      ownerName: null,
      ownerEmail: null,
      breadcrumb: [],
      folders: ownFolders.map((row) => ({
        ...row,
        access: "owner" as const,
        ownerName: null,
        ownerEmail: null,
        shareId: null,
        sharedCount: counts.get(row.id) ?? 0,
      })),
      scripts: ownScripts.map((row) => ({
        ...row,
        access: "owner" as const,
        ownerName: null,
        ownerEmail: null,
        shareId: null,
        sharedCount: counts.get(row.id) ?? 0,
      })),
    };
  }

  const { folder, access } = await requireFolder(
    db,
    viewer,
    folderId,
    "viewer",
  );

  // Everything below the gate is independent of everything else below it, so
  // it goes in one round trip rather than five. `grantsFor` in particular used
  // to run above this point, before the folder was even known to exist, and
  // the account's own top level, which is the view this app opens on, never
  // read the answer at all.
  const [grants, owner, map, childFolders, childScripts] = await Promise.all([
    grantsFor(db, viewer),
    ownerOf(db, folder.ownerId),
    loadFolders(db, [folder.ownerId]),
    db.query.folders.findMany({
      where: eq(folders.parentId, folder.id),
      orderBy: [folders.name],
    }),
    db.query.scripts.findMany({
      where: eq(scripts.folderId, folder.id),
      orderBy: [desc(scripts.updatedAt)],
      limit: 200,
    }),
  ]);

  // A breadcrumb stops where the viewer's access stops. Showing somebody the
  // names of the folders above the one they were given is a small leak, and
  // offering them as links is a broken one.
  const chain = ancestorChain(map, folder.id).reverse();
  const visible: Folder[] = [];
  for (const step of chain) {
    if (
      folder.ownerId === viewer.id ||
      visible.length > 0 ||
      grants.folderRoots.has(step.id)
    ) {
      visible.push(step);
    }
  }

  const mine = folder.ownerId === viewer.id;
  // Everything in this folder inherits every grant made on it or on anything
  // above it, so those addresses belong in each child's tally as well.
  const reachedFromAbove = mine
    ? new Set(
        (await inheritedShares(db, folder.ownerId, folder.id, map)).flatMap(
          (step) => step.rows.map((row) => row.email),
        ),
      )
    : new Set<string>();
  const counts = mine
    ? await shareCounts(
        db,
        childFolders.map((row) => row.id),
        childScripts.map((row) => row.id),
        reachedFromAbove,
      )
    : new Map<string, number>();

  const entry = {
    access,
    ownerName: mine ? null : (owner?.name ?? null),
    ownerEmail: mine ? null : (owner?.email ?? null),
    shareId: null,
  };

  return {
    folder,
    access,
    ownerName: entry.ownerName,
    ownerEmail: entry.ownerEmail,
    breadcrumb: visible,
    folders: childFolders.map((row) => ({
      ...row,
      ...entry,
      sharedCount: counts.get(row.id) ?? 0,
    })),
    scripts: childScripts.map((row) => ({
      ...row,
      ...entry,
      sharedCount: counts.get(row.id) ?? 0,
      // A script inside a shared folder can carry a stronger grant of its own.
      access: stronger(access, grants.scriptGrants.get(row.id)?.role ?? null)!,
    })),
  };
}

/**
 * The roots of what other people have shared, for the viewer's top level.
 *
 * Only roots: a script inside a shared folder is reachable by opening the
 * folder, and listing it here as well would show the same script twice with
 * no indication they were the same one.
 */
export async function sharedRoots(
  db: Db,
  viewer: Viewer,
): Promise<{
  folders: Array<Folder & LibraryEntry>;
  scripts: Array<Script & LibraryEntry>;
}> {
  const grants = await grantsFor(db, viewer);
  if (grants.ownerIds.length === 0) return { folders: [], scripts: [] };

  const map = await loadFolders(db, grants.ownerIds);
  const owners = await ownersOf(db, grants.ownerIds);

  // A folder whose own parent is also shared with you is not a root: it will
  // appear inside that parent, and listing both puts the same folder in two
  // places at the top level.
  const rootFolders: Folder[] = [];
  for (const id of grants.folderRoots.keys()) {
    const folder = map.get(id);
    if (!folder) continue;
    const covered = ancestorChain(map, folder.parentId).some((step) =>
      grants.folderRoots.has(step.id),
    );
    if (!covered) rootFolders.push(folder);
  }

  const coveredFolderIds = withDescendants(map, grants.folderRoots.keys());
  const scriptIds = [...grants.scriptGrants.keys()];
  const granted =
    scriptIds.length > 0
      ? await db.query.scripts.findMany({
          where: inArray(scripts.id, scriptIds),
          orderBy: [desc(scripts.updatedAt)],
        })
      : [];

  const looseScripts = granted.filter(
    (script) => !script.folderId || !coveredFolderIds.has(script.folderId),
  );

  const decorate = <T extends { ownerId: string }>(row: T, grant: Grant) => {
    const owner = owners.get(row.ownerId);
    return {
      ...row,
      access: grant.role as Access,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      shareId: grant.shareId,
      sharedCount: 0,
    };
  };

  return {
    folders: rootFolders
      .map((folder) => decorate(folder, grants.folderRoots.get(folder.id)!))
      .sort((a, b) => a.name.localeCompare(b.name)),
    scripts: looseScripts.map((script) =>
      decorate(script, grants.scriptGrants.get(script.id)!),
    ),
  };
}

async function ownerOf(db: Db, id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, name: true, email: true },
  });
}

async function ownersOf(db: Db, ids: string[]) {
  if (ids.length === 0)
    return new Map<string, { name: string | null; email: string }>();
  const rows = await db.query.users.findMany({
    where: inArray(users.id, ids),
    columns: { id: true, name: true, email: true },
  });
  return new Map(
    rows.map((row) => [row.id, { name: row.name, email: row.email }]),
  );
}
