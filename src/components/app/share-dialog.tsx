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
import { api } from "~/trpc/react";

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
    void utils.share.list.invalidate(scope);
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
          ) : list.data && list.data.length > 0 ? (
            <ul className="space-y-1">
              {list.data.map((person) => (
                <li
                  key={person.id}
                  className="flex flex-wrap items-center gap-3 rounded-sm px-1 py-2"
                >
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
                  </span>

                  {person.hasAccount ? null : (
                    <span title="No Teleprompt account with this address yet">
                      <Badge tone="neutral">Waiting</Badge>
                    </span>
                  )}

                  <RolePicker
                    value={person.role}
                    disabled={setRoleFor.isPending}
                    onChange={(next) =>
                      setRoleFor.mutate({ id: person.id, role: next })
                    }
                    label={`Permission for ${person.name ?? person.email}`}
                  />
                  <button
                    type="button"
                    onClick={() => revoke.mutate({ id: person.id })}
                    aria-label={`Remove ${person.email}`}
                    title="Remove"
                    className="text-faint transition-colors hover:text-coral"
                  >
                    <TrashSimple size={15} weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.8125rem] leading-relaxed text-muted">
              Not shared with anyone yet.
            </p>
          )}
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
              next time they sign in with that address — tell them it is there.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
