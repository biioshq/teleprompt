"use client";

import { useMemo, useState } from "react";
import {
  CaretRight,
  Folder as FolderIcon,
  House,
  X,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "~/components/ui/button";
import { type Folder } from "~/server/db/schema";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

export type MoveTarget =
  | { kind: "script"; id: string; name: string; folderId: string | null }
  | { kind: "folder"; id: string; name: string; folderId: string | null };

/**
 * Indented list rather than a collapsible tree.
 *
 * A folder scheme people actually keep is a dozen or so entries; a tree with
 * disclosure arrows would be more chrome than content, and every click to
 * expand is a click between the person and the thing they are trying to do.
 */
function flatten(
  folders: Folder[],
  parentId: string | null,
  depth: number,
  excluded: Set<string>,
): Array<{ folder: Folder; depth: number }> {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .filter((folder) => !excluded.has(folder.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((folder) => [
      { folder, depth },
      ...flatten(folders, folder.id, depth + 1, excluded),
    ]);
}

export function MoveDialog({
  target,
  onClose,
}: {
  target: MoveTarget;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const tree = api.folder.tree.useQuery();
  const [selected, setSelected] = useState<string | null>(target.folderId);

  const done = () => {
    void utils.library.browse.invalidate();
    void utils.folder.tree.invalidate();
    onClose();
  };

  const moveScript = api.script.move.useMutation({ onSuccess: done });
  const moveFolder = api.folder.move.useMutation({ onSuccess: done });
  const pending = moveScript.isPending || moveFolder.isPending;
  const error = moveScript.error ?? moveFolder.error;

  /**
   * A folder cannot be moved into itself or into anything it contains. The
   * server refuses it too; this only keeps the impossible choice off screen,
   * because offering an option and then rejecting it is a worse way to explain
   * a rule than not offering it.
   */
  const excluded = useMemo(() => {
    const out = new Set<string>();
    if (target.kind !== "folder" || !tree.data) return out;
    const queue = [target.id];
    while (queue.length > 0) {
      const id = queue.pop()!;
      out.add(id);
      for (const folder of tree.data) {
        if (folder.parentId === id) queue.push(folder.id);
      }
    }
    return out;
  }, [target, tree.data]);

  const rows = useMemo(
    () => (tree.data ? flatten(tree.data, null, 0, excluded) : []),
    [excluded, tree.data],
  );

  const submit = () => {
    if (target.kind === "script") {
      moveScript.mutate({ id: target.id, folderId: selected });
    } else {
      moveFolder.mutate({ id: target.id, parentId: selected });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 pad-safe-bottom sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Move ${target.name}`}
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-hidden rounded-t-lg border border-ink bg-surface shadow-hard-lg sm:rounded-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Move</p>
            <p className="mt-0.5 truncate text-[0.75rem] text-muted">
              {target.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-faint transition-colors hover:text-ink"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="max-h-[45dvh] overflow-y-auto overscroll-contain p-2">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[0.875rem] transition-colors",
              selected === null
                ? "bg-brand-soft text-brand-deep"
                : "text-ink hover:bg-paper-deep",
            )}
          >
            <House size={15} weight="bold" className="shrink-0" />
            All scripts
          </button>

          {rows.map(({ folder, depth }) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setSelected(folder.id)}
              style={{ paddingLeft: `${0.75 + depth * 1.1}rem` }}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm py-2 pr-3 text-left text-[0.875rem] transition-colors",
                selected === folder.id
                  ? "bg-brand-soft text-brand-deep"
                  : "text-ink hover:bg-paper-deep",
              )}
            >
              {depth > 0 ? (
                <CaretRight
                  size={11}
                  weight="bold"
                  className="shrink-0 text-faint"
                />
              ) : null}
              <FolderIcon
                size={15}
                weight="fill"
                className="shrink-0 text-brand"
              />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}

          {rows.length === 0 && !tree.isLoading ? (
            <p className="px-3 py-4 text-[0.8125rem] text-muted">
              No folders yet. Create one first.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          {error ? (
            <p className="mr-auto text-[0.75rem] text-coral">{error.message}</p>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={pending || selected === target.folderId}
          >
            {pending ? "Moving…" : "Move here"}
          </Button>
        </div>
      </div>
    </div>
  );
}
