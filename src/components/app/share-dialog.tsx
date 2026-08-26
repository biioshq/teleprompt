"use client";

import { useState } from "react";
import {
  Check,
  Envelope,
  Folder as FolderIcon,
  FileText,
  TrashSimple,
  X,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Select, type SelectOption } from "~/components/ui/select";
import { type ShareRole } from "~/server/db/schema";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

export type ShareTarget =
  | { kind: "script"; id: string; name: string }
  | { kind: "folder"; id: string; name: string };

const ROLE_LABEL: Record<ShareRole, string> = {
  viewer: "Can view",
  editor: "Can edit",
};

const ROLE_DETAIL: Record<ShareRole, string> = {
  viewer: "Read it and present from it. Cannot change the words.",
  editor: "Read it, present it, and edit the words.",
};

const ROLE_OPTIONS: ReadonlyArray<SelectOption<ShareRole>> = [
  { value: "viewer", label: ROLE_LABEL.viewer },
  { value: "editor", label: ROLE_LABEL.editor },
];

function RolePicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: ShareRole;
  onChange: (role: ShareRole) => void;
  disabled?: boolean;
  /** Named for a screen reader: there are as many of these as there are rows. */
  label: string;
}) {
  return (
    <Select
      value={value}
      options={ROLE_OPTIONS}
      onChange={onChange}
      disabled={disabled}
      aria-label={label}
    />
  );
}

/** Reads as a sentence whether one folder reaches somebody or three do. */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.14em] text-muted uppercase">
      {children}
    </p>
  );
}

/**
 * A name inside an eyebrow, spelled the way its owner spelled it.
 *
 * The label around it is set in the mono uppercase the rest of the dialog uses
 * for headings, and that is fine for words this file wrote. A folder called
 * GoVMLab is not one of those: shouting it back as GOVMLAB makes the reader
 * check whether it is really the folder they think it is.
 */
function Proper({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-[0.75rem] font-semibold tracking-normal text-ink normal-case">
      {children}
    </span>
  );
}

/**
 * One person, however they got here.
 *
 * The control on the right is passed in rather than chosen here: a grant made
 * on this thing can be changed from this row, and one arriving from a folder
 * above cannot, because changing it there would change it for everything else
 * in that folder too.
 */
function PersonRow({
  person,
  note,
  children,
}: {
  person: { name: string | null; email: string; hasAccount: boolean };
  note?: string | null;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-sm px-1 py-2">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-deep font-mono text-[0.6875rem] text-muted">
        {(person.name ?? person.email).slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] text-ink">
          {person.name ?? person.email}
        </span>
        {person.name ? (
          <span className="block truncate text-[0.6875rem] text-faint">
            {person.email}
          </span>
        ) : null}
        {note ? (
          <span className="mt-0.5 block text-[0.6875rem] leading-snug text-faint">
            {note}
          </span>
        ) : null}
      </span>

      {person.hasAccount ? null : (
        <span title="No Teleprompt account with this address yet">
          <Badge tone="neutral">Waiting</Badge>
        </span>
      )}

      {children}
    </li>
  );
}

/**
 * Who can see this, and why.
 *
 * Two answers rather than one. `direct` was granted on this exact thing;
 * `inherited` arrives from a folder above and is grouped by the folder that is
 * the reason, because "three people can read this" is not much use until it
 * says which folder handed it to them.
 */
export function AccessList({
  access,
  thing,
  busy,
  onSetRole,
  onRevoke,
  error,
}: {
  access: RouterOutputs["share"]["list"];
  /** What the dialog is about, for the sentence about how far a removal goes. */
  thing: "script" | "folder";
  busy?: boolean;
  onSetRole: (id: string, role: ShareRole) => void;
  onRevoke: (id: string) => void;
  error?: string | null;
}) {
  // Purely about what is on screen: the row it belongs to unmounts the moment
  // the grant is gone, which is the only reset it needs.
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  const { direct, inherited } = access;

  if (direct.length === 0 && inherited.length === 0) {
    return (
      <p className="text-[0.8125rem] leading-relaxed text-muted">
        Not shared with anyone yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {direct.length > 0 ? (
        <section>
          {/* Named only when there is something to tell it apart from. */}
          {inherited.length > 0 ? <Eyebrow>Shared directly</Eyebrow> : null}
          <ul className="space-y-1">
            {direct.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                note={
                  person.via.length > 0
                    ? `Also reached through ${listNames(person.via)}.`
                    : null
                }
              >
                <RolePicker
                  value={person.role}
                  disabled={busy}
                  onChange={(next) => onSetRole(person.id, next)}
                  label={`Permission for ${person.name ?? person.email}`}
                />
                <button
                  type="button"
                  onClick={() => onRevoke(person.id)}
                  aria-label={`Remove ${person.email}`}
                  title="Remove"
                  className="text-faint transition-colors hover:text-coral"
                >
                  <TrashSimple size={15} weight="bold" />
                </button>
              </PersonRow>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Reached from above.
          The level is shown rather than offered: it was set on the folder and
          applies to everything inside it, and a picker here would quietly
          change all of that from a dialog about one thing. Taking the grant
          away is offered, because this is where the surprise happened and so
          this is where somebody will want to undo it, but it asks once and
          names the folder in the asking. */}
      {inherited.length > 0 ? (
        <div className="space-y-4">
          {/* Said once. It is the same warning for every folder above, and
              repeating it under each heading turns it into wallpaper. */}
          <p className="text-[0.75rem] leading-relaxed text-muted">
            The rest is set on a folder, so it is the same for everything inside
            that folder. Removing someone below takes away the whole folder, not
            just this {thing}.
          </p>

          {inherited.map((group) => (
            <section key={group.folderId}>
              <Eyebrow>
                <FolderIcon size={11} weight="fill" className="text-brand" />
                Because <Proper>{group.folderName}</Proper> is shared
              </Eyebrow>
              <ul className="space-y-1">
                {group.people.map((person) => {
                  const confirming = pendingRevoke === person.id;
                  return (
                    <PersonRow
                      key={person.id}
                      person={person}
                      note={
                        person.alsoDirect
                          ? "Shared directly as well, which this does not remove."
                          : null
                      }
                    >
                      <Badge tone="neutral">{ROLE_LABEL[person.role]}</Badge>

                      <button
                        type="button"
                        onClick={() =>
                          setPendingRevoke(confirming ? null : person.id)
                        }
                        aria-expanded={confirming}
                        aria-label={`Remove ${person.email} from ${group.folderName}`}
                        title={`Remove from ${group.folderName}`}
                        className={cn(
                          "transition-colors hover:text-coral",
                          confirming ? "text-coral" : "text-faint",
                        )}
                      >
                        <TrashSimple size={15} weight="bold" />
                      </button>

                      {/* Full width, so asking does not shunt the row it is
                          asking about sideways. */}
                      {confirming ? (
                        <span className="flex w-full justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => onRevoke(person.id)}
                            className="text-[0.75rem] font-medium text-coral"
                          >
                            Remove from {group.folderName}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingRevoke(null)}
                            className="text-[0.75rem] text-faint"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : null}
                    </PersonRow>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-[0.75rem] text-coral">{error}</p> : null}
    </div>
  );
}

export function ShareDialog({
  target,
  onClose,
}: {
  target: ShareTarget;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const scope =
    target.kind === "script"
      ? { scriptId: target.id }
      : { folderId: target.id };

  const list = api.share.list.useQuery(scope);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const invalidate = () => {
    // Every list, not just this one: a grant on a folder is on the list of
    // everything filed under it, so taking one back changes lists this dialog
    // does not know the scope of.
    void utils.share.list.invalidate();
    void utils.library.browse.invalidate();
    void utils.library.sharedWithMe.invalidate();
  };

  const grant = api.share.grant.useMutation({
    onSuccess: (row) => {
      setEmail("");
      setJustAdded(row.email);
      window.setTimeout(() => setJustAdded(null), 2600);
      invalidate();
    },
  });
  const setRoleFor = api.share.setRole.useMutation({ onSuccess: invalidate });
  const revoke = api.share.revoke.useMutation({ onSuccess: invalidate });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    grant.mutate({ ...scope, email, role });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 pad-safe-bottom sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${target.name}`}
    >
      <div
        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-lg border border-ink bg-surface shadow-hard-lg sm:rounded-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              {target.kind === "folder" ? (
                <FolderIcon size={15} weight="fill" className="text-brand" />
              ) : (
                <FileText size={15} weight="bold" className="text-brand" />
              )}
              <span className="truncate">{target.name}</span>
            </p>
            <p className="mt-1 text-[0.75rem] text-muted">
              {target.kind === "folder"
                ? "Everything in this folder, including folders inside it."
                : "This script only."}
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

        {/* Add ------------------------------------------------------------ */}
        <form onSubmit={submit} className="border-b border-line px-5 py-4">
          <label
            htmlFor="share-email"
            className="mb-1.5 block font-mono text-[0.625rem] tracking-[0.14em] text-muted uppercase"
          >
            Invite by email
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="share-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="person@example.com"
              autoComplete="off"
              className="h-9 min-w-0 flex-1 rounded-sm border border-line bg-paper px-3 text-[0.875rem] text-ink outline-none placeholder:text-faint focus:border-ink"
            />
            <RolePicker
              value={role}
              onChange={setRole}
              label="Permission for the person you invite"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={grant.isPending || email.trim().length === 0}
            >
              {grant.isPending ? "Adding…" : "Add"}
            </Button>
          </div>

          <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
            {ROLE_DETAIL[role]}
          </p>

          {grant.error ? (
            <p className="mt-2 text-[0.75rem] text-coral">
              {grant.error.message}
            </p>
          ) : null}

          {justAdded ? (
            <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-jade">
              <Check size={12} weight="bold" />
              {justAdded} can reach it now.
            </p>
          ) : null}
        </form>

        {/* People --------------------------------------------------------- */}
        <div className="px-5 py-4">
          {list.isLoading ? (
            <p className="text-[0.8125rem] text-faint">Loading…</p>
          ) : list.data ? (
            <AccessList
              access={list.data}
              thing={target.kind}
              busy={setRoleFor.isPending}
              onSetRole={(id, next) => setRoleFor.mutate({ id, role: next })}
              onRevoke={(id) => revoke.mutate({ id })}
              error={revoke.error?.message ?? null}
            />
          ) : null}
        </div>

        {/* The honest footnote -------------------------------------------- */}
        <div className="border-t border-line bg-paper px-5 py-3">
          <p className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted">
            <Envelope
              size={13}
              weight="bold"
              className={cn("mt-0.5 shrink-0 text-faint")}
            />
            <span>
              Teleprompt does not send email. Whoever you add will find this
              under <strong className="text-ink">Shared with me</strong> the
              next time they sign in with that address: tell them it is there.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
