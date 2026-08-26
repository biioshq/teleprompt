/**
 * The permission rules, and the folder-tree arithmetic they rest on.
 *
 * Nothing in this file fetches anything. That is the point: "who may do what"
 * is a set of statements about ownership and inheritance, and keeping it free
 * of queries means it can be read as those statements and tested as them; see
 * `access.test.ts`. `access.ts` does the loading and calls in here for the
 * answer.
 */

import type { Folder, Script, ShareRole } from "~/server/db/schema";

export type Access = "owner" | "editor" | "viewer";

const RANK: Record<Access, number> = { viewer: 1, editor: 2, owner: 3 };

export function allows(access: Access | null, minimum: Access): boolean {
  return access !== null && RANK[access] >= RANK[minimum];
}

/** The stronger of two grants. Sharing a folder *and* a script inside it is a
 *  perfectly normal thing to do, and the more generous grant is what was
 *  meant: a person given editing rights on one script does not lose them
 *  because the folder around it was later shared read-only with a group. */
export function stronger(a: Access | null, b: Access | null): Access | null {
  if (!a) return b;
  if (!b) return a;
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * How deep folders may nest.
 *
 * Not a database constraint, because the useful place to refuse is the move
 * that would break it, where there is something to say. Eight is past any real
 * filing scheme and keeps a breadcrumb readable on a phone.
 */
export const MAX_DEPTH = 8;

export type Viewer = { id: string; email: string };

/**
 * The signed-in person, as this file needs them.
 *
 * The address matters as much as the id here, because grants are keyed by
 * address. It is read from the database rather than taken on trust from the
 * session: the session is assembled from the same row, but access control is
 * the wrong place to depend on that staying true.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* The folder tree                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Every folder belonging to a set of accounts, as a lookup.
 *
 * The tree is walked in JavaScript rather than by a recursive query, which is
 * a deliberate trade. A recursive CTE is the textbook answer and would be the
 * right one for a filesystem; here the working set is one person's filing
 * scheme, which is tens of folders, and loading it whole makes ancestry,
 * descendants and cycle checks ordinary code that can be read and tested
 * instead of three near-identical SQL fragments.
 */
export type FolderMap = Map<string, Folder>;

/**
 * A folder and everything above it, nearest first.
 *
 * The visited set is not defensive programming for its own sake: a cycle here
 * would hang a request rather than return a wrong answer, and a hang is the
 * one failure this code must not have.
 */
export function ancestorChain(map: FolderMap, folderId: string | null) {
  const chain: Folder[] = [];
  const seen = new Set<string>();
  let current = folderId;
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    const folder = map.get(current);
    if (!folder) break;
    chain.push(folder);
    current = folder.parentId;
  }
  return chain;
}

/** Parent id -> child ids, built once and reused by the walks below. */
export function childrenMap(map: FolderMap): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const folder of map.values()) {
    if (!folder.parentId) continue;
    const list = children.get(folder.parentId) ?? [];
    list.push(folder.id);
    children.set(folder.parentId, list);
  }
  return children;
}

/** The folders themselves plus everything filed beneath them. */
export function withDescendants(
  map: FolderMap,
  rootIds: Iterable<string>,
): Set<string> {
  const children = childrenMap(map);

  const out = new Set<string>();
  const queue = [...rootIds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const child of children.get(id) ?? []) queue.push(child);
  }
  return out;
}

/**
 * How many levels a folder sits below the top of the account.
 *
 * A folder with no parent is 1, and the top level itself is 0, so a breadcrumb
 * length and a depth are the same number.
 */
export function depthOf(map: FolderMap, folderId: string | null): number {
  return ancestorChain(map, folderId).length;
}

/**
 * Levels occupied by a folder and everything under it, the folder counting as
 * one. Needed before a move: dropping a three-deep subtree two levels down has
 * to be refused as a whole, not discovered one level at a time.
 */
export function subtreeHeight(map: FolderMap, rootId: string): number {
  const children = childrenMap(map);
  let height = 0;
  let level = [rootId];
  const seen = new Set<string>();
  while (level.length > 0) {
    height += 1;
    const next: string[] = [];
    for (const id of level) {
      if (seen.has(id)) continue;
      seen.add(id);
      next.push(...(children.get(id) ?? []));
    }
    level = next;
  }
  return height;
}

/* -------------------------------------------------------------------------- */
/* Grants                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every grant made to this address, resolved to the folders they cover.
 *
 * Returned as roots rather than as a flattened list of everything reachable,
 * because the two callers want different things from it: an access check wants
 * to know whether one particular folder is covered, and the dashboard wants to
 * show the shared folders themselves rather than their contents.
 */
/** A grant, with the row behind it so the recipient can give it back. */
export type Grant = { role: ShareRole; shareId: string };

export type Grants = {
  /** Folder id -> the strongest grant made on it directly. */
  folderRoots: Map<string, Grant>;
  /** Script id -> the strongest grant made on it directly. */
  scriptGrants: Map<string, Grant>;
  /** The accounts that granted something, so their trees can be loaded. */
  ownerIds: string[];
};

export function keepStronger(
  into: Map<string, Grant>,
  key: string,
  candidate: Grant,
) {
  const current = into.get(key);
  if (!current || RANK[candidate.role] > RANK[current.role]) {
    into.set(key, candidate);
  }
}

/**
 * Grants laid back over the folders they were made on, nearest folder first.
 *
 * Folders with nothing on them drop out, so what is left is exactly the list
 * of reasons something is reachable, in the order a person would read them:
 * the nearest folder is the one they most likely have in mind.
 */
export function groupByFolder<T extends { folderId: string | null }>(
  chain: Folder[],
  rows: T[],
): Array<{ folder: Folder; rows: T[] }> {
  const byFolder = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.folderId) continue;
    const list = byFolder.get(row.folderId) ?? [];
    list.push(row);
    byFolder.set(row.folderId, list);
  }

  return chain
    .filter((folder) => byFolder.has(folder.id))
    .map((folder) => ({ folder, rows: byFolder.get(folder.id)! }));
}

/**
 * The rules themselves, with nothing to fetch.
 *
 * Kept separate from the loading so that "who may do what" can be read, and
 * tested, as a set of statements about ownership and inheritance rather than
 * as a consequence of two queries. This is the part that must not be wrong.
 *
 * Ownership first, then a grant on the thing itself, then a grant on any
 * folder it sits inside, however far up. The strongest of those wins.
 */
export function resolveScriptAccess(
  viewer: Viewer,
  script: Pick<Script, "id" | "ownerId" | "folderId">,
  grants: Grants,
  map: FolderMap,
): Access | null {
  if (script.ownerId === viewer.id) return "owner";

  let access: Access | null = grants.scriptGrants.get(script.id)?.role ?? null;
  for (const folder of ancestorChain(map, script.folderId)) {
    const granted = grants.folderRoots.get(folder.id);
    if (granted) access = stronger(access, granted.role);
  }
  return access;
}

export function resolveFolderAccess(
  viewer: Viewer,
  folder: Pick<Folder, "id" | "ownerId">,
  grants: Grants,
  map: FolderMap,
): Access | null {
  if (folder.ownerId === viewer.id) return "owner";

  let access: Access | null = null;
  for (const ancestor of ancestorChain(map, folder.id)) {
    const granted = grants.folderRoots.get(ancestor.id);
    if (granted) access = stronger(access, granted.role);
  }
  return access;
}
