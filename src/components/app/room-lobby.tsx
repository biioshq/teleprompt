"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowClockwise,
  ArrowLeft,
  Check,
  Copy,
  DeviceMobile,
  Monitor,
} from "@phosphor-icons/react/dist/ssr";

import { InstallPrompt } from "~/components/pwa/install-prompt";
import { Badge, LiveDot } from "~/components/ui/badge";
import { Button, ButtonLink } from "~/components/ui/button";
import { formatDuration, readingTimeSeconds } from "~/lib/prompter/state";
import { relativeTime } from "~/lib/utils";
import { api } from "~/trpc/react";

export function RoomLobby({ roomId }: { roomId: string }) {
  const router = useRouter();
  const utils = api.useUtils();
  const [copied, setCopied] = useState(false);

  const room = api.room.byId.useQuery(
    { id: roomId },
    { retry: false, refetchInterval: 8000 },
  );

  const script = api.script.byId.useQuery(
    { id: room.data?.scriptId ?? "" },
    { enabled: Boolean(room.data?.scriptId), retry: false },
  );

  const refresh = api.room.refreshContent.useMutation({
    onSuccess: () => void utils.room.byId.invalidate({ id: roomId }),
  });

  const end = api.room.end.useMutation({
    onSuccess: () => {
      void utils.room.listLive.invalidate();
      router.push("/app");
    },
  });

  if (room.isLoading) {
    return (
      <main className="mx-auto max-w-4xl py-16 gutter">
        <div className="h-72 animate-pulse rounded-sm border border-line bg-surface" />
      </main>
    );
  }

  if (room.error || !room.data) {
    return (
      <main className="mx-auto max-w-md py-24 gutter text-center">
        <h1 className="text-2xl">Room not available</h1>
        <p className="mt-3 text-[0.9375rem] text-muted">
          {room.error?.message ?? "It may have ended."}
        </p>
        <ButtonLink href="/app" variant="outline" className="mt-7">
          Back to scripts
        </ButtonLink>
      </main>
    );
  }

  const data = room.data;
  const stale = script.data ? script.data.body !== data.content : false;
  const seconds = readingTimeSeconds(data.wordCount, data.state.speedWpm);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused; the code is on screen regardless.
    }
  };

  return (
    <main className="mx-auto max-w-4xl py-8 gutter">
      <Link
        href={data.scriptId ? `/app/scripts/${data.scriptId}` : "/app"}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} weight="bold" />
        Back to the script
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LiveDot active={data.status === "live"} />
            <span className="eyebrow">
              {data.status === "live" ? "Room open" : "Room ended"}
            </span>
          </div>
          <h1 className="mt-3 text-3xl">{data.title}</h1>
          <p className="mt-2 text-[0.9375rem] text-muted">
            {data.wordCount.toLocaleString()} words · about{" "}
            {formatDuration(seconds)} at {data.state.speedWpm} wpm
          </p>
        </div>

        <button
          type="button"
          onClick={() => void copyCode()}
          className="group rounded-sm border border-ink bg-surface px-6 py-4 text-left shadow-hard transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-lg"
        >
          <span className="block font-mono text-[0.625rem] tracking-[0.16em] text-muted uppercase">
            Join code
          </span>
          <span className="mt-1 flex items-center gap-3 font-mono text-2xl tracking-[0.18em] text-ink">
            {data.code}
            {copied ? (
              <Check size={16} weight="bold" className="text-jade" />
            ) : (
              <Copy
                size={16}
                weight="bold"
                className="text-faint transition-colors group-hover:text-ink"
              />
            )}
          </span>
        </button>
      </div>

      {/* Roles ------------------------------------------------------------ */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href={`/prompter/${data.id}`}
          className="group rounded-sm border border-line bg-surface p-6 transition-colors hover:border-ink"
        >
          <Monitor size={22} weight="bold" className="text-brand" />
          <h2 className="mt-4 text-lg">Use this device as the display</h2>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
            Full screen, mirrored if you are shooting through glass. Point it at
            yourself and leave it alone.
          </p>
          <span className="mt-4 inline-block text-sm text-ink underline decoration-brand decoration-2 underline-offset-4">
            Open the display
          </span>
        </Link>

        <Link
          href={`/remote/${data.id}`}
          className="group rounded-sm border border-line bg-surface p-6 transition-colors hover:border-ink"
        >
          <DeviceMobile size={22} weight="bold" className="text-brand" />
          <h2 className="mt-4 text-lg">Use this device as the remote</h2>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
            The same words in your hand, with play, pace and tap-to-jump. This
            is the device you keep.
          </p>
          <span className="mt-4 inline-block text-sm text-ink underline decoration-brand decoration-2 underline-offset-4">
            Open the remote
          </span>
        </Link>
      </div>

      {/* Pairing instructions --------------------------------------------- */}
      <section className="mt-6 rounded-sm border border-line bg-paper-deep p-6">
        <h2 className="text-base font-semibold">On the other device</h2>
        <ol className="mt-4 space-y-2.5 text-[0.875rem] leading-relaxed text-muted">
          <li>
            <span className="font-medium text-ink">1.</span> Open{" "}
            <span className="font-mono text-ink">teleprompt</span> and sign in
            to the same account.
          </li>
          <li>
            <span className="font-medium text-ink">2.</span> Go to{" "}
            <Link
              href="/join"
              className="text-ink underline decoration-brand decoration-2 underline-offset-2"
            >
              Join a room
            </Link>{" "}
            and enter{" "}
            <span className="font-mono tracking-[0.16em] text-ink">
              {data.code}
            </span>
            .
          </li>
          <li>
            <span className="font-medium text-ink">3.</span> Pick the role that
            device should play. The two find each other on their own.
          </li>
        </ol>
        <div className="mt-5">
          <InstallPrompt />
        </div>
      </section>

      {/* Devices ---------------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="mb-3 eyebrow">Devices in this room</h2>
        {data.devices.length === 0 ? (
          <p className="text-[0.875rem] text-faint">
            Nothing has joined yet. Open a role above to get started.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-sm border border-line bg-surface">
            {data.devices.map((device) => (
              <li key={device.id} className="flex items-center gap-3 px-4 py-3">
                {device.role === "prompter" ? (
                  <Monitor size={15} weight="bold" className="text-brand" />
                ) : (
                  <DeviceMobile
                    size={15}
                    weight="bold"
                    className="text-brand"
                  />
                )}
                <span className="text-sm text-ink">{device.label}</span>
                <Badge tone="neutral">{device.role}</Badge>
                <span className="ml-auto text-[0.75rem] text-faint">
                  {relativeTime(new Date(device.lastSeenAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Room actions ------------------------------------------------------ */}
      <section className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-8">
        {stale ? (
          <div className="mr-auto flex w-full items-center gap-3 rounded-sm border border-brand bg-brand-soft px-4 py-3 sm:w-auto">
            <ArrowClockwise
              size={16}
              weight="bold"
              className="shrink-0 text-brand-deep"
            />
            <p className="text-[0.8125rem] leading-snug text-brand-deep">
              This room is behind the script. It normally catches up on its own,
              so this is a manual nudge.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh.mutate({ roomId: data.id })}
              disabled={refresh.isPending}
            >
              {refresh.isPending ? "Pulling…" : "Pull in edits"}
            </Button>
          </div>
        ) : (
          <p className="mr-auto text-[0.8125rem] text-faint">
            Opened {relativeTime(new Date(data.createdAt))}. Rooms close
            themselves after 12 quiet hours.
          </p>
        )}

        <Button
          variant="danger"
          size="sm"
          onClick={() => end.mutate({ roomId: data.id })}
          disabled={end.isPending}
        >
          {end.isPending ? "Ending…" : "End room"}
        </Button>
      </section>
    </main>
  );
}
