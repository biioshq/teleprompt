"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowsOutCardinal,
  CaretRight,
  Copy,
  DeviceMobile,
  FileText,
  FolderPlus,
  Folder as FolderIcon,
  FolderOpen,
  House,
  Monitor,
  PencilSimple,
  Plus,
  ShareNetwork,
  SignOut,
  TrashSimple,
  Users,
} from "@phosphor-icons/react/dist/ssr";

import { MoveDialog, type MoveTarget } from "~/components/app/move-dialog";
import { ShareDialog, type ShareTarget } from "~/components/app/share-dialog";
import { InstallPrompt } from "~/components/pwa/install-prompt";
import { Badge, LiveDot } from "~/components/ui/badge";
import { Button, ButtonLink } from "~/components/ui/button";
import { summarise } from "~/lib/markdown/blocks";
import { formatDuration, readingTimeSeconds } from "~/lib/prompter/state";
import { cn, pluralise, relativeTime } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type Access = "owner" | "editor" | "viewer";

/**
 * The library.
 *
 * One folder at a time rather than a persistent tree in a sidebar: on a phone
 * a sidebar is a drawer nobody opens, and the breadcrumb carries the same
 * information in a line of text. Everything shared with you sits at the top
 * level, because that is where you look for it, and never anywhere else:
 * a folder inside a shared folder is reached by opening the folder, not by
 * appearing twice.
 */
export function LibraryBoard({ folderId }: { folderId: string | null }) {
  const router = useRouter();
  const utils = api.useUtils();

  const view = api.library.browse.useQuery({ folderId });
  const shared = api.library.sharedWithMe.useQuery(undefined, {
    enabled: folderId === null,
  });
  const liveRooms = api.room.listLive.useQuery();

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sharing, setSharing] = useState<ShareTarget | null>(null);
  const [moving, setMoving] = useState<MoveTarget | null>(null);

  const refresh = () => {
    void utils.library.browse.invalidate();
    void utils.library.sharedWithMe.invalidate();
    void utils.folder.tree.invalidate();
    void utils.script.list.invalidate();
  };

  /**
   * Change the board now, ask the server after.
   *
   * Renaming and deleting used to wait for two round trips before anything on
   * screen moved: the mutation itself, and then the refetch its invalidation
   * triggered. Neither is slow on its own, but they are serial and they sit
   * between the click and the only evidence that the click registered, so
   * every action felt like the app had missed it.
   *
   * These edits are all ones the server cannot refuse for a reason the client
   * does not already know: the buttons only render for an owner, and access was
   * settled before the card was drawn. So the optimistic answer is the real one
   * often enough to be worth showing, and `onError` puts the old board back on
   * the rare occasion it is not.
   */
  const patchBoard = async (
    edit: (
      data: RouterOutputs["library"]["browse"],
    ) => RouterOutputs["library"]["browse"],
  ) => {
    // Stop any refetch already in flight, or it can land after this edit and
    // overwrite it with the state the server held a moment ago.
    await utils.library.browse.cancel({ folderId });
    const previous = utils.library.browse.getData({ folderId });
    utils.library.browse.setData({ folderId }, (old) =>
      old ? edit(old) : old,
    );
    return { previous };
  };

  const restoreBoard = (context?: {
    previous?: RouterOutputs["library"]["browse"];
  }) => {
    if (context?.previous) {
      utils.library.browse.setData({ folderId }, context.previous);
    }
  };

  const createScript = api.script.create.useMutation({
    onSuccess: (script) => {
      refresh();
      router.push(`/app/scripts/${script.id}`);
    },
  });
  const createFolder = api.folder.create.useMutation({
    onSuccess: (folder) => {
      refresh();
      setRenaming(folder.id);
      setRenameValue(folder.name);
    },
  });
  const renameFolder = api.folder.rename.useMutation({
    onMutate: ({ id, name }) => {
      setRenaming(null);
      return patchBoard((data) => ({
        ...data,
        folders: data.folders.map((folder) =>
          folder.id === id ? { ...folder, name } : folder,
        ),
      }));
    },
    onError: (_error, _input, context) => restoreBoard(context),
    onSettled: refresh,
  });
  const removeFolder = api.folder.remove.useMutation({
    onMutate: ({ id }) => {
      setPendingDelete(null);
      return patchBoard((data) => ({
        ...data,
        folders: data.folders.filter((folder) => folder.id !== id),
      }));
    },
    onError: (_error, _input, context) => restoreBoard(context),
    // The scripts that were inside come back to the top level, and only the
    // server knows which those are, so this one really does need the refetch;
    // it just no longer has to happen before the folder disappears.
    onSettled: refresh,
  });
  const duplicate = api.script.duplicate.useMutation({ onSuccess: refresh });
  const removeScript = api.script.remove.useMutation({
    onMutate: ({ id }) => {
      setPendingDelete(null);
      return patchBoard((data) => ({
        ...data,
        scripts: data.scripts.filter((script) => script.id !== id),
      }));
    },
    onError: (_error, _input, context) => restoreBoard(context),
    onSettled: refresh,
  });
  const leave = api.share.leave.useMutation({
    onMutate: ({ id }) => {
      setPendingDelete(null);
      return patchBoard((data) => ({
        ...data,
        folders: data.folders.filter((folder) => folder.shareId !== id),
        scripts: data.scripts.filter((script) => script.shareId !== id),
      }));
    },
    onError: (_error, _input, context) => restoreBoard(context),
    onSettled: refresh,
  });

  const data = view.data;
  const canEditHere = data?.access === "owner";
  const sharedIsEmpty =
    !shared.data ||
    (shared.data.folders.length === 0 && shared.data.scripts.length === 0);
  const isEmpty =
    view.isSuccess && data!.folders.length === 0 && data!.scripts.length === 0;

  if (view.error) {
    return (
      <main className="mx-auto max-w-md py-24 gutter text-center">
        <h1 className="text-2xl">Folder not found</h1>
        <p className="mt-3 text-[0.9375rem] text-muted">{view.error.message}</p>
        <ButtonLink href="/app" variant="outline" className="mt-7">
          All scripts
        </ButtonLink>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl py-10 gutter">
      {/* Live rooms ------------------------------------------------------- */}
      {folderId === null && liveRooms.data && liveRooms.data.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 eyebrow">Live now</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {liveRooms.data.map((room) => (
              <li
                key={room.id}
                className="flex items-center gap-4 rounded-sm border border-ink bg-surface p-4 shadow-hard"
              >
                <LiveDot />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {room.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.6875rem] tracking-[0.16em] text-muted">
                    {room.code} · {relativeTime(new Date(room.lastActiveAt))}
                  </p>
                </div>
                <ButtonLink
                  href={`/app/rooms/${room.id}`}
                  variant="outline"
                  size="sm"
                >
                  Open
                </ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Header ----------------------------------------------------------- */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Breadcrumb
            trail={data?.breadcrumb ?? []}
            ownerName={data?.ownerName ?? data?.ownerEmail ?? null}
          />
          <h1 className="mt-2 truncate text-3xl">
            {data?.folder ? data.folder.name : "Scripts"}
          </h1>
          <p className="mt-2 text-[0.9375rem] text-muted">
            {data?.folder
              ? data.access === "owner"
                ? "Shared folders pass their access down to everything inside."
                : `Shared with you: you can ${data.access === "editor" ? "edit" : "read and present"} what is in here.`
              : "Write here, then send the words to whichever screen is pointed at you."}
          </p>
        </div>

        {canEditHere ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => createFolder.mutate({ parentId: folderId })}
              disabled={createFolder.isPending}
            >
              <FolderPlus size={16} weight="bold" />
              New folder
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                createScript.mutate({ folderId, starter: isEmpty && !folderId })
              }
              disabled={createScript.isPending}
            >
              <Plus size={16} weight="bold" />
              {createScript.isPending ? "Creating…" : "New script"}
            </Button>
          </div>
        ) : null}
      </div>

      {createFolder.error ? (
        <p className="mb-4 text-[0.8125rem] text-coral">
          {createFolder.error.message}
        </p>
      ) : null}

      {/* Folders ---------------------------------------------------------- */}
      {view.isLoading ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <li
              key={key}
              className="h-40 animate-pulse rounded-sm border border-line bg-surface"
            />
          ))}
        </ul>
      ) : (
        <>
          {data && data.folders.length > 0 ? (
            <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.folders.map((folder) => {
                const confirming = pendingDelete === folder.id;
                const editing = renaming === folder.id;

                return (
                  <li
                    key={folder.id}
                    className="group flex items-center gap-3 rounded-sm border border-line bg-surface p-4 transition-colors hover:border-ink"
                  >
                    <FolderIcon
                      size={22}
                      weight="fill"
                      className="shrink-0 text-brand"
                    />

                    {editing ? (
                      <form
                        className="flex min-w-0 flex-1 items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          renameFolder.mutate({
                            id: folder.id,
                            name: renameValue,
                          });
                        }}
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(event) =>
                            setRenameValue(event.target.value)
                          }
                          onBlur={() =>
                            renameFolder.mutate({
                              id: folder.id,
                              name: renameValue,
                            })
                          }
                          className="h-8 min-w-0 flex-1 rounded-sm border border-ink bg-paper px-2 text-[0.875rem] text-ink outline-none"
                        />
                      </form>
                    ) : (
                      <Link
                        href={`/app/folders/${folder.id}`}
                        className="min-w-0 flex-1"
                      >
                        <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                          {folder.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
                          {(folder.ownerName ?? folder.ownerEmail) ? (
                            <>
                              Shared by {folder.ownerName ?? folder.ownerEmail}
                            </>
                          ) : folder.sharedCount > 0 ? (
                            <>
                              Shared with {folder.sharedCount}{" "}
                              {pluralise(
                                folder.sharedCount,
                                "person",
                                "people",
                              )}
                            </>
                          ) : (
                            relativeTime(new Date(folder.updatedAt))
                          )}
                        </span>
                      </Link>
                    )}

                    {folder.access !== "owner" ? (
                      <AccessBadge access={folder.access} />
                    ) : null}

                    {folder.access === "owner" && !editing ? (
                      <FolderActions
                        onRename={() => {
                          setRenaming(folder.id);
                          setRenameValue(folder.name);
                        }}
                        onShare={() =>
                          setSharing({
                            kind: "folder",
                            id: folder.id,
                            name: folder.name,
                          })
                        }
                        onMove={() =>
                          setMoving({
                            kind: "folder",
                            id: folder.id,
                            name: folder.name,
                            folderId: folder.parentId,
                          })
                        }
                        confirming={confirming}
                        onDelete={() => setPendingDelete(folder.id)}
                        onConfirm={() => removeFolder.mutate({ id: folder.id })}
                        onCancel={() => setPendingDelete(null)}
                      />
                    ) : folder.shareId ? (
                      <LeaveButton
                        confirming={confirming}
                        onAsk={() => setPendingDelete(folder.id)}
                        onCancel={() => setPendingDelete(null)}
                        onConfirm={() => leave.mutate({ id: folder.shareId! })}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/* Scripts ------------------------------------------------------ */}
          {data && data.scripts.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.scripts.map((script) => {
                const seconds = readingTimeSeconds(script.wordCount);
                const confirming = pendingDelete === script.id;

                return (
                  <li
                    key={script.id}
                    className="group flex flex-col rounded-sm border border-line bg-surface p-5 transition-colors hover:border-ink"
                  >
                    <Link href={`/app/scripts/${script.id}`} className="flex-1">
                      <h3 className="line-clamp-2 text-base leading-snug font-semibold text-ink">
                        {script.title}
                      </h3>
                      <p className="mt-3 font-mono text-[0.6875rem] tracking-[0.1em] text-faint uppercase">
                        {script.wordCount} {pluralise(script.wordCount, "word")}{" "}
                        · {formatDuration(seconds)} read
                      </p>
                      <p className="mt-4 line-clamp-3 text-[0.8125rem] leading-relaxed text-muted">
                        {summarise(script.body) || "Empty script"}
                      </p>
                    </Link>

                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                      <span className="mr-auto truncate text-[0.6875rem] text-faint">
                        {(script.ownerName ?? script.ownerEmail) ? (
                          <>Shared by {script.ownerName ?? script.ownerEmail}</>
                        ) : script.sharedCount > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Users size={11} weight="bold" />
                            {script.sharedCount}
                          </span>
                        ) : (
                          relativeTime(new Date(script.updatedAt))
                        )}
                      </span>

                      {script.access !== "owner" ? (
                        <AccessBadge access={script.access} />
                      ) : null}

                      <button
                        type="button"
                        onClick={() => duplicate.mutate({ id: script.id })}
                        // The copy is named and numbered by the server, so this
                        // is the one action here that cannot be drawn before the
                        // answer arrives. It can at least say it is working.
                        disabled={duplicate.isPending}
                        aria-label="Duplicate"
                        title={
                          script.access === "owner"
                            ? "Duplicate"
                            : "Save a copy I can edit"
                        }
                        className="text-faint transition-colors hover:text-ink disabled:opacity-50"
                      >
                        <Copy size={15} weight="bold" />
                      </button>

                      {script.access === "owner" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setSharing({
                                kind: "script",
                                id: script.id,
                                name: script.title,
                              })
                            }
                            aria-label="Share"
                            title="Share"
                            className="text-faint transition-colors hover:text-ink"
                          >
                            <ShareNetwork size={15} weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMoving({
                                kind: "script",
                                id: script.id,
                                name: script.title,
                                folderId: script.folderId,
                              })
                            }
                            aria-label="Move"
                            title="Move to folder"
                            className="text-faint transition-colors hover:text-ink"
                          >
                            <ArrowsOutCardinal size={15} weight="bold" />
                          </button>

                          {confirming ? (
                            <span className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  removeScript.mutate({ id: script.id })
                                }
                                className="text-[0.75rem] font-medium text-coral"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete(null)}
                                className="text-[0.75rem] text-faint"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingDelete(script.id)}
                              aria-label="Delete"
                              title="Delete"
                              className="text-faint transition-colors hover:text-coral"
                            >
                              <TrashSimple size={15} weight="bold" />
                            </button>
                          )}
                        </>
                      ) : script.shareId ? (
                        <LeaveButton
                          confirming={confirming}
                          onAsk={() => setPendingDelete(script.id)}
                          onCancel={() => setPendingDelete(null)}
                          onConfirm={() =>
                            leave.mutate({ id: script.shareId! })
                          }
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {isEmpty ? (
            <EmptyState
              inFolder={Boolean(data?.folder)}
              canEdit={Boolean(canEditHere)}
              onStarter={() => createScript.mutate({ starter: true })}
              pending={createScript.isPending}
            />
          ) : null}
        </>
      )}

      {/* Shared with me --------------------------------------------------- */}
      {folderId === null && !sharedIsEmpty ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="mb-1 eyebrow">Shared with me</h2>
          <p className="mb-5 text-[0.8125rem] text-muted">
            Other people&rsquo;s work, reachable from your account.
          </p>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shared.data?.folders.map((folder) => (
              <li
                key={folder.id}
                className="flex items-center gap-3 rounded-sm border border-line bg-surface p-4 transition-colors hover:border-ink"
              >
                <FolderOpen
                  size={22}
                  weight="fill"
                  className="shrink-0 text-brand"
                />
                <Link
                  href={`/app/folders/${folder.id}`}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                    {folder.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
                    {folder.ownerName ?? folder.ownerEmail}
                  </span>
                </Link>
                <AccessBadge access={folder.access} />
              </li>
            ))}

            {shared.data?.scripts.map((script) => (
              <li
                key={script.id}
                className="flex items-center gap-3 rounded-sm border border-line bg-surface p-4 transition-colors hover:border-ink"
              >
                <FileText
                  size={20}
                  weight="bold"
                  className="shrink-0 text-brand"
                />
                <Link
                  href={`/app/scripts/${script.id}`}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                    {script.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
                    {script.ownerName ?? script.ownerEmail}
                  </span>
                </Link>
                <AccessBadge access={script.access} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Footer aids ------------------------------------------------------ */}
      {folderId === null ? (
        <section className="mt-14 grid gap-6 border-t border-line pt-10 md:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 font-mono text-[0.6875rem] tracking-[0.1em] text-muted uppercase">
              <Monitor size={13} weight="bold" className="text-brand" />
              Display
            </p>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
              Open a script, press{" "}
              <strong className="text-ink">Start a session</strong>, and leave
              that device facing you.
            </p>
          </div>
          <div>
            <p className="flex items-center gap-2 font-mono text-[0.6875rem] tracking-[0.1em] text-muted uppercase">
              <DeviceMobile size={13} weight="bold" className="text-brand" />
              Remote
            </p>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
              On your phone, sign in as the same person and{" "}
              <Link
                href="/join"
                className="text-ink underline decoration-brand decoration-2 underline-offset-2"
              >
                enter the room code
              </Link>
              .
            </p>
          </div>
          <div>
            <InstallPrompt />
          </div>
        </section>
      ) : null}

      {sharing ? (
        <ShareDialog target={sharing} onClose={() => setSharing(null)} />
      ) : null}
      {moving ? (
        <MoveDialog target={moving} onClose={() => setMoving(null)} />
      ) : null}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function Breadcrumb({
  trail,
  ownerName,
}: {
  trail: Array<{ id: string; name: string }>;
  ownerName: string | null;
}) {
  if (trail.length === 0) return null;
  const path = trail.slice(0, -1);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-[0.75rem] text-muted"
    >
      <Link
        href="/app"
        className="inline-flex items-center gap-1 transition-colors hover:text-ink"
      >
        <House size={12} weight="bold" />
        All scripts
      </Link>
      {path.map((step) => (
        <span key={step.id} className="inline-flex items-center gap-1">
          <CaretRight size={10} weight="bold" className="text-faint" />
          <Link
            href={`/app/folders/${step.id}`}
            className="max-w-[12rem] truncate transition-colors hover:text-ink"
          >
            {step.name}
          </Link>
        </span>
      ))}
      {ownerName ? (
        <span className="ml-2 text-faint">· shared by {ownerName}</span>
      ) : null}
    </nav>
  );
}

function AccessBadge({ access }: { access: Access }) {
  if (access === "owner") return null;
  return (
    <Badge tone={access === "editor" ? "jade" : "neutral"}>
      {access === "editor" ? "Editor" : "View only"}
    </Badge>
  );
}

function FolderActions({
  onRename,
  onShare,
  onMove,
  confirming,
  onDelete,
  onConfirm,
  onCancel,
}: {
  onRename: () => void;
  onShare: () => void;
  onMove: () => void;
  confirming: boolean;
  onDelete: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="text-[0.75rem] font-medium text-coral"
          title="Scripts inside come back to All scripts"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[0.75rem] text-faint"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onRename}
        aria-label="Rename"
        title="Rename"
        className="text-faint transition-colors hover:text-ink"
      >
        <PencilSimple size={15} weight="bold" />
      </button>
      <button
        type="button"
        onClick={onShare}
        aria-label="Share"
        title="Share"
        className="text-faint transition-colors hover:text-ink"
      >
        <ShareNetwork size={15} weight="bold" />
      </button>
      <button
        type="button"
        onClick={onMove}
        aria-label="Move"
        title="Move"
        className="text-faint transition-colors hover:text-ink"
      >
        <ArrowsOutCardinal size={15} weight="bold" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        title="Delete"
        className="text-faint transition-colors hover:text-coral"
      >
        <TrashSimple size={15} weight="bold" />
      </button>
    </span>
  );
}

/** Give back access somebody granted you. Not a delete: nothing is destroyed. */
function LeaveButton({
  confirming,
  onAsk,
  onCancel,
  onConfirm,
}: {
  confirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="text-[0.75rem] font-medium text-coral"
        >
          Remove
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[0.75rem] text-faint"
        >
          Cancel
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onAsk}
      aria-label="Remove from my library"
      title="Remove from my library; the owner keeps it"
      className="shrink-0 text-faint transition-colors hover:text-coral"
    >
      <SignOut size={15} weight="bold" />
    </button>
  );
}

function EmptyState({
  inFolder,
  canEdit,
  onStarter,
  pending,
}: {
  inFolder: boolean;
  canEdit: boolean;
  onStarter: () => void;
  pending: boolean;
}) {
  return (
    <div className="rounded-sm border border-line bg-surface p-10 text-center">
      <FileText size={26} weight="bold" className="mx-auto text-brand" />
      <h2 className="mt-5 text-xl">
        {inFolder ? "This folder is empty" : "Nothing written yet"}
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-muted">
        {inFolder
          ? canEdit
            ? "Add a script here, or move one in from somewhere else."
            : "Nothing has been put in here yet."
          : "Start with the sample script: it walks through connecting a second device while you read it off the first."}
      </p>
      {!inFolder && canEdit ? (
        <Button
          variant="brand"
          className="mt-6"
          onClick={onStarter}
          disabled={pending}
        >
          <Plus size={16} weight="bold" />
          Write my first script
        </Button>
      ) : null}
    </div>
  );
}
