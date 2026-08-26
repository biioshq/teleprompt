import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allows,
  ancestorChain,
  depthOf,
  resolveFolderAccess,
  resolveScriptAccess,
  subtreeHeight,
  withDescendants,
  type FolderMap,
  type Grants,
  type Viewer,
} from "./tree.ts";

/**
 * The permission rules, pinned.
 *
 * `resolveScriptAccess` and `resolveFolderAccess` are deliberately free of any
 * fetching so that this file can state the rules directly rather than through
 * a stubbed database. Run with `npm test`.
 *
 * These are the assertions that decide whether one account can read another
 * account's work. Every one of them is a sentence somebody would be upset to
 * find false.
 */

const ALICE: Viewer = { id: "alice", email: "alice@example.com" };
const BOB: Viewer = { id: "bob", email: "bob@example.com" };

/** Alice's filing: work/ > clients/ > acme/, and a separate personal/. */
function tree(): FolderMap {
  const make = (id: string, parentId: string | null) =>
    [
      id,
      {
        id,
        ownerId: "alice",
        parentId,
        name: id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as const;

  return new Map([
    make("work", null),
    make("clients", "work"),
    make("acme", "clients"),
    make("personal", null),
  ] as never);
}

const script = (id: string, folderId: string | null, ownerId = "alice") => ({
  id,
  ownerId,
  folderId,
});

const NOTHING: Grants = {
  folderRoots: new Map(),
  scriptGrants: new Map(),
  ownerIds: [],
};

function granting(
  folders: Array<[string, "viewer" | "editor"]>,
  scripts: Array<[string, "viewer" | "editor"]> = [],
): Grants {
  return {
    folderRoots: new Map(
      folders.map(([id, role]) => [id, { role, shareId: `share-${id}` }]),
    ),
    scriptGrants: new Map(
      scripts.map(([id, role]) => [id, { role, shareId: `share-${id}` }]),
    ),
    ownerIds: ["alice"],
  };
}

describe("ownership", () => {
  it("an owner owns their script", () => {
    assert.equal(
      resolveScriptAccess(ALICE, script("deck", "acme"), NOTHING, tree()),
      "owner",
    );
  });

  it("an owner owns their folder", () => {
    assert.equal(
      resolveFolderAccess(
        ALICE,
        { id: "work", ownerId: "alice" },
        NOTHING,
        tree(),
      ),
      "owner",
    );
  });

  it("somebody with no grant gets nothing", () => {
    assert.equal(
      resolveScriptAccess(BOB, script("deck", "acme"), NOTHING, tree()),
      null,
    );
  });

  it("a grant never weakens ownership", () => {
    assert.equal(
      resolveScriptAccess(
        ALICE,
        script("deck", "acme"),
        granting([["work", "viewer"]], [["deck", "viewer"]]),
        tree(),
      ),
      "owner",
    );
  });
});

describe("direct grants", () => {
  it("carries the role it was given", () => {
    for (const role of ["viewer", "editor"] as const) {
      assert.equal(
        resolveScriptAccess(
          BOB,
          script("deck", null),
          granting([], [["deck", role]]),
          tree(),
        ),
        role,
      );
    }
  });

  it("reaches a folder", () => {
    assert.equal(
      resolveFolderAccess(
        BOB,
        { id: "work", ownerId: "alice" },
        granting([["work", "viewer"]]),
        tree(),
      ),
      "viewer",
    );
  });
});

describe("inheritance", () => {
  it("a folder grant reaches a script inside it", () => {
    assert.equal(
      resolveScriptAccess(
        BOB,
        script("deck", "acme"),
        granting([["clients", "editor"]]),
        tree(),
      ),
      "editor",
    );
  });

  it("reaches all the way down", () => {
    assert.equal(
      resolveScriptAccess(
        BOB,
        script("deck", "acme"),
        granting([["work", "viewer"]]),
        tree(),
      ),
      "viewer",
    );
    assert.equal(
      resolveFolderAccess(
        BOB,
        { id: "acme", ownerId: "alice" },
        granting([["work", "editor"]]),
        tree(),
      ),
      "editor",
    );
  });

  it("does not leak sideways", () => {
    assert.equal(
      resolveScriptAccess(
        BOB,
        script("deck", "acme"),
        granting([["personal", "editor"]]),
        tree(),
      ),
      null,
    );
  });

  it("does not travel upwards", () => {
    assert.equal(
      resolveFolderAccess(
        BOB,
        { id: "work", ownerId: "alice" },
        granting([["acme", "editor"]]),
        tree(),
      ),
      null,
    );
  });

  it("ignores folder grants for a script that is not filed", () => {
    assert.equal(
      resolveScriptAccess(
        BOB,
        script("loose", null),
        granting([["work", "editor"]]),
        tree(),
      ),
      null,
    );
  });
});

describe("two grants on the same thing", () => {
  it("takes the more generous one, whichever way round", () => {
    const cases: Array<[Grants, string]> = [
      [granting([["work", "viewer"]], [["deck", "editor"]]), "editor"],
      [granting([["work", "editor"]], [["deck", "viewer"]]), "editor"],
      [
        granting([
          ["work", "viewer"],
          ["acme", "editor"],
        ]),
        "editor",
      ],
      [
        granting([
          ["work", "editor"],
          ["acme", "viewer"],
        ]),
        "editor",
      ],
    ];
    for (const [grants, expected] of cases) {
      assert.equal(
        resolveScriptAccess(BOB, script("deck", "acme"), grants, tree()),
        expected,
      );
    }
  });
});

describe("role ranking", () => {
  it("orders viewer below editor below owner", () => {
    assert.equal(allows("viewer", "viewer"), true);
    assert.equal(allows("viewer", "editor"), false);
    assert.equal(allows("editor", "viewer"), true);
    assert.equal(allows("editor", "owner"), false);
    assert.equal(allows("owner", "editor"), true);
    assert.equal(allows("owner", "owner"), true);
    assert.equal(allows(null, "viewer"), false);
  });
});

describe("tree arithmetic", () => {
  it("measures depth from the top of the account", () => {
    assert.equal(depthOf(tree(), null), 0);
    assert.equal(depthOf(tree(), "work"), 1);
    assert.equal(depthOf(tree(), "acme"), 3);
  });

  it("measures how many levels a subtree occupies", () => {
    assert.equal(subtreeHeight(tree(), "work"), 3);
    assert.equal(subtreeHeight(tree(), "acme"), 1);
  });

  it("collects descendants", () => {
    assert.deepEqual([...withDescendants(tree(), ["work"])].sort(), [
      "acme",
      "clients",
      "work",
    ]);
    assert.deepEqual([...withDescendants(tree(), ["acme"])], ["acme"]);
  });
});

describe("a cycle", () => {
  /**
   * A cycle should be impossible — `folder.move` refuses to create one. This
   * is here because the consequence of being wrong about that is not a wrong
   * answer but a request that never returns, and a hung request is the one
   * failure this code is not allowed to have.
   */
  const cyclic = new Map([
    ["a", { id: "a", ownerId: "alice", parentId: "b", name: "a" }],
    ["b", { id: "b", ownerId: "alice", parentId: "a", name: "b" }],
  ] as never) as FolderMap;

  it("does not hang any of the walks", () => {
    assert.equal(ancestorChain(cyclic, "a").length, 2);
    assert.deepEqual([...withDescendants(cyclic, ["a"])].sort(), ["a", "b"]);
    assert.ok(subtreeHeight(cyclic, "a") > 0);
  });
});
