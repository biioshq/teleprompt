"use client";

import Link from "next/link";

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
    <div className="flex min-h-[100dvh] items-center justify-center bg-stage px-6">
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

export function StageLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-stage">
      <div className="flex items-center gap-3">
        <span className="animate-live inline-block h-2 w-2 rounded-full bg-brand" />
        <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-stage-muted uppercase">
          {label}
        </span>
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
