"use client";

import Link from "next/link";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr";

import { Mark } from "~/components/brand/logo";
import { ButtonLink } from "~/components/ui/button";

/** Shared loading and failure states for the two live surfaces. */
export function StageMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-stage gutter">
      <div className="w-full max-w-sm text-center">
        <Mark className="mx-auto h-10 w-10" />
        <h1 className="mt-7 text-2xl text-stage-ink">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-stage-muted">
          {detail}
        </p>
        <div className="mt-7 flex justify-center gap-3">
          {action ?? (
            <ButtonLink href="/app" variant="stage">
              Back to scripts
            </ButtonLink>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Why a room stopped being a room.
 *
 * `closed` is somebody pressing End room; `expired` is the window running out.
 * `unknown` is a device arriving at a room that was already over, where the
 * stored status cannot tell the two apart: better to say nothing about the
 * cause than to guess wrong at it.
 */
export type ClosedReason = "closed" | "expired" | "unknown";

const CLOSED_DETAIL: Record<ClosedReason, string> = {
  closed: "Someone ended this room. Open a new one from the script.",
  expired:
    "This room went five quiet minutes with nothing on it. Open a new one from the script.",
  unknown: "Open a new one from the script.",
};

/** The one terminal screen for a room that is over, however it got there. */
export function RoomClosed({ reason }: { reason: ClosedReason }) {
  return <StageMessage title="Room ended" detail={CLOSED_DETAIL[reason]} />;
}

export function StageLoading({
  label,
  slow = false,
  onRetry,
}: {
  label: string;
  /** Taking longer than it should; say so instead of spinning silently. */
  slow?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-stage gutter">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <span className="animate-live inline-block h-2 w-2 rounded-full bg-brand" />
          <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-stage-muted uppercase">
            {label}
          </span>
        </div>

        {slow ? (
          <>
            <p className="max-w-xs text-[0.8125rem] leading-relaxed text-stage-muted">
              This is taking longer than it should. The connection may have
              changed since the page loaded.
            </p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-sm border border-stage-line px-4 py-2 text-[0.8125rem] text-stage-ink transition-colors hover:border-brand hover:text-brand"
              >
                <ArrowClockwise size={14} weight="bold" />
                Try again
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ExitLink({ roomId }: { roomId: string }) {
  return (
    <Link
      href={`/app/rooms/${roomId}`}
      className="font-mono text-[0.6875rem] tracking-[0.12em] text-stage-muted uppercase transition-colors hover:text-stage-ink"
    >
      Leave
    </Link>
  );
}
