"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  CloudSlash,
  Play,
} from "@phosphor-icons/react/dist/ssr";

import { MarkdownEditor } from "~/components/app/markdown-editor";
import { Cue } from "~/components/brand/cue";
import { Button, ButtonLink } from "~/components/ui/button";
import { splitIntoBlocks, spokenWordCount } from "~/lib/markdown/blocks";
import { formatDuration, readingTimeSeconds } from "~/lib/prompter/state";
import { pluralise } from "~/lib/utils";
import { api } from "~/trpc/react";

const AUTOSAVE_DELAY_MS = 900;

export function ScriptEditor({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const utils = api.useUtils();
  const script = api.script.byId.useQuery({ id: scriptId }, { retry: false });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [height, setHeight] = useState(480);

  const update = api.script.update.useMutation({
    onSuccess: () => {
      setDirty(false);
      void utils.script.list.invalidate();
    },
  });

  const createRoom = api.room.create.useMutation({
    onSuccess: (room) => {
      void utils.room.listLive.invalidate();
      router.push(`/app/rooms/${room.id}`);
    },
  });

  // Seed local state once; after that the editor is the source of truth.
  useEffect(() => {
    if (!script.data || hydrated) return;
    setTitle(script.data.title);
    setBody(script.data.body);
    setHydrated(true);
  }, [hydrated, script.data]);

  useEffect(() => {
    const resize = () =>
      setHeight(Math.max(320, Math.min(720, window.innerHeight - 300)));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Debounced autosave. Nobody should have to think about saving a script.
  const saveRef = useRef(update.mutate);
  saveRef.current = update.mutate;
  useEffect(() => {
    if (!hydrated || !dirty) return;
    const timer = window.setTimeout(() => {
      saveRef.current({ id: scriptId, title, body });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [body, dirty, hydrated, scriptId, title]);

  // A last-ditch flush if the tab is closed mid-edit.
  useEffect(() => {
    const onHide = () => {
      if (dirty) saveRef.current({ id: scriptId, title, body });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [body, dirty, scriptId, title]);

  const stats = useMemo(() => {
    const blocks = splitIntoBlocks(body);
    return {
      words: spokenWordCount(blocks),
      blocks: blocks.length,
      cues: blocks.filter((block) => block.kind === "cue").length,
      sections: blocks.filter((block) => block.kind === "heading").length,
    };
  }, [body]);

  if (script.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        <div className="h-[520px] animate-pulse rounded-sm border border-line bg-surface" />
      </main>
    );
  }

  if (script.error || !script.data) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl">Script not found</h1>
        <p className="mt-3 text-[0.9375rem] text-muted">
          {script.error?.message ?? "It may have been deleted."}
        </p>
        <ButtonLink href="/app" variant="outline" className="mt-7">
          Back to scripts
        </ButtonLink>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <Link
        href="/app"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} weight="bold" />
        All scripts
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
        {/* Editor --------------------------------------------------------- */}
        <div className="min-w-0">
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setDirty(true);
            }}
            aria-label="Script title"
            placeholder="Untitled script"
            className="mb-5 w-full border-0 bg-transparent p-0 font-display text-3xl tracking-[-0.025em] text-ink outline-none placeholder:text-faint"
          />

          <div className="overflow-hidden rounded-sm border border-line">
            <MarkdownEditor
              value={body}
              onChange={(next) => {
                setBody(next);
                setDirty(true);
              }}
              height={height}
            />
          </div>

          <div className="mt-3 flex items-center gap-2 text-[0.75rem] text-faint">
            {update.isPending ? (
              <>
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                Saving
              </>
            ) : update.isError ? (
              <>
                <CloudSlash size={13} weight="bold" className="text-coral" />
                <span className="text-coral">
                  Could not save — check your connection
                </span>
              </>
            ) : dirty ? (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-faint" />
                Unsaved changes
              </>
            ) : (
              <>
                <CheckCircle size={13} weight="bold" className="text-jade" />
                Saved
              </>
            )}
          </div>
        </div>

        {/* Sidebar -------------------------------------------------------- */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Button
            variant="brand"
            size="lg"
            className="w-full"
            onClick={() => createRoom.mutate({ scriptId })}
            disabled={createRoom.isPending || stats.words === 0}
          >
            <Play size={17} weight="fill" />
            {createRoom.isPending ? "Opening room…" : "Start a session"}
          </Button>
          {stats.words === 0 ? (
            <p className="-mt-3 text-[0.75rem] leading-relaxed text-faint">
              Write something first — an empty script has nothing to scroll.
            </p>
          ) : null}

          <dl className="rounded-sm border border-line bg-surface">
            {[
              {
                label: "Words",
                value: stats.words.toLocaleString(),
              },
              {
                label: "At 130 wpm",
                value: formatDuration(readingTimeSeconds(stats.words)),
              },
              {
                label: "Blocks",
                value: `${stats.blocks} ${pluralise(stats.blocks, "block")}`,
              },
              {
                label: "Sections",
                value: String(stats.sections),
              },
              {
                label: "Cues",
                value: String(stats.cues),
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between border-b border-line px-4 py-3 last:border-b-0"
              >
                <dt className="font-mono text-[0.625rem] tracking-[0.14em] text-muted uppercase">
                  {row.label}
                </dt>
                <dd className="text-sm font-medium text-ink tabular">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="rounded-sm border border-line bg-surface p-4">
            <Cue>syntax</Cue>
            <ul className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed text-muted">
              <li>
                <code className="font-mono text-ink">## Section</code> splits
                the script into parts.
              </li>
              <li>
                <code className="font-mono text-ink">- bullet</code> gives you
                one beat per line.
              </li>
              <li>
                <code className="font-mono text-ink">:: cue</code> is a note for
                you, never counted as words.
              </li>
              <li>
                <code className="font-mono text-ink">---</code> marks a hard
                break.
              </li>
            </ul>
            <Link
              href="/docs/writing-scripts"
              className="mt-4 inline-block text-[0.8125rem] text-ink underline decoration-brand decoration-2 underline-offset-4"
            >
              Writing scripts
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
