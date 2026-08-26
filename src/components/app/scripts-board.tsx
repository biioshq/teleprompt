"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  DeviceMobile,
  FileText,
  Monitor,
  Plus,
  TrashSimple,
} from "@phosphor-icons/react/dist/ssr";

import { InstallPrompt } from "~/components/pwa/install-prompt";
import { LiveDot } from "~/components/ui/badge";
import { Button, ButtonLink } from "~/components/ui/button";
import { summarise } from "~/lib/markdown/blocks";
import { formatDuration, readingTimeSeconds } from "~/lib/prompter/state";
import { pluralise, relativeTime } from "~/lib/utils";
import { api } from "~/trpc/react";

export function ScriptsBoard() {
  const router = useRouter();
  const utils = api.useUtils();

  const scripts = api.script.list.useQuery();
  const liveRooms = api.room.listLive.useQuery();

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const createScript = api.script.create.useMutation({
    onSuccess: (script) => {
      void utils.script.list.invalidate();
      router.push(`/app/scripts/${script.id}`);
    },
  });

  const duplicate = api.script.duplicate.useMutation({
    onSuccess: () => void utils.script.list.invalidate(),
  });

  const remove = api.script.remove.useMutation({
    onSuccess: () => {
      setPendingDelete(null);
      void utils.script.list.invalidate();
    },
  });

  const isEmpty = scripts.isSuccess && scripts.data.length === 0;

  return (
    <main className="mx-auto max-w-6xl py-10 gutter">
      {/* Live rooms ------------------------------------------------------- */}
      {liveRooms.data && liveRooms.data.length > 0 ? (
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
        <div>
          <h1 className="text-3xl">Scripts</h1>
          <p className="mt-2 text-[0.9375rem] text-muted">
            Write here, then send the words to whichever screen is pointed at
            you.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => createScript.mutate({ starter: isEmpty })}
          disabled={createScript.isPending}
        >
          <Plus size={16} weight="bold" />
          {createScript.isPending ? "Creating…" : "New script"}
        </Button>
      </div>

      {/* List ------------------------------------------------------------- */}
      {scripts.isLoading ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <li
              key={key}
              className="h-40 animate-pulse rounded-sm border border-line bg-surface"
            />
          ))}
        </ul>
      ) : isEmpty ? (
        <div className="rounded-sm border border-line bg-surface p-10 text-center">
          <FileText size={26} weight="bold" className="mx-auto text-brand" />
          <h2 className="mt-5 text-xl">Nothing written yet</h2>
          <p className="mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-muted">
            Start with the sample script; it walks through connecting a second
            device while you read it off the first.
          </p>
          <Button
            variant="brand"
            className="mt-6"
            onClick={() => createScript.mutate({ starter: true })}
            disabled={createScript.isPending}
          >
            <Plus size={16} weight="bold" />
            Write my first script
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scripts.data?.map((script) => {
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
                    {script.wordCount} {pluralise(script.wordCount, "word")} ·{" "}
                    {formatDuration(seconds)} read
                  </p>
                  <p className="mt-4 line-clamp-3 text-[0.8125rem] leading-relaxed text-muted">
                    {summarise(script.body) || "Empty script"}
                  </p>
                </Link>

                <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
                  <span className="mr-auto text-[0.6875rem] text-faint">
                    {relativeTime(new Date(script.updatedAt))}
                  </span>

                  <button
                    type="button"
                    onClick={() => duplicate.mutate({ id: script.id })}
                    aria-label="Duplicate"
                    title="Duplicate"
                    className="text-faint transition-colors hover:text-ink"
                  >
                    <Copy size={15} weight="bold" />
                  </button>

                  {confirming ? (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => remove.mutate({ id: script.id })}
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
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer aids ------------------------------------------------------ */}
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
    </main>
  );
}
