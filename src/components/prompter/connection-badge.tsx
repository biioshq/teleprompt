"use client";

import {
  Broadcast,
  DeviceMobile,
  Lightning,
  Monitor,
  WifiSlash,
} from "@phosphor-icons/react/dist/ssr";

import {
  type LinkStatus,
  type PresencePeer,
  type TransportMode,
} from "~/lib/realtime/link";
import { cn } from "~/lib/utils";

const TRANSPORT_COPY: Record<TransportMode, { label: string; detail: string }> =
  {
    direct: {
      label: "Direct",
      detail: "Peer-to-peer data channel — nothing in between",
    },
    relay: {
      label: "Relay",
      detail: "Via the realtime relay — no direct route between these devices",
    },
    alone: {
      label: "Waiting",
      detail: "No other device on this room yet",
    },
  };

export function ConnectionBadge({
  status,
  transport,
  latencyMs,
  peers,
  className,
  tone = "stage",
}: {
  status: LinkStatus;
  transport: TransportMode;
  latencyMs: number | null;
  peers: PresencePeer[];
  className?: string;
  tone?: "stage" | "paper";
}) {
  const offline = status !== "online";
  const copy = TRANSPORT_COPY[transport];

  const Icon = offline
    ? WifiSlash
    : transport === "direct"
      ? Lightning
      : Broadcast;

  const colour = offline
    ? "text-coral"
    : transport === "direct"
      ? "text-brand"
      : transport === "relay"
        ? "text-blue"
        : tone === "stage"
          ? "text-stage-muted"
          : "text-muted";

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={offline ? "Reconnecting" : copy.detail}
    >
      <Icon size={14} weight="bold" className={colour} />
      <span
        className={cn(
          "font-mono text-[0.6875rem] tracking-[0.08em] uppercase",
          tone === "stage" ? "text-stage-muted" : "text-muted",
        )}
      >
        {offline
          ? status === "reconnecting"
            ? "Reconnecting"
            : "Connecting"
          : copy.label}
        {latencyMs !== null && !offline ? (
          <span className="ml-1.5 tabular opacity-70">{latencyMs}ms</span>
        ) : null}
      </span>

      {peers.length > 0 ? (
        <span className="ml-1 flex items-center gap-1">
          {peers.slice(0, 3).map((peer) => (
            <span
              key={peer.deviceKey}
              title={`${peer.label} · ${peer.role}${peer.direct ? " · direct" : ""}`}
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                peer.direct
                  ? "border-brand text-brand"
                  : tone === "stage"
                    ? "border-stage-line text-stage-muted"
                    : "border-line text-muted",
              )}
            >
              {peer.role === "prompter" ? (
                <Monitor size={11} weight="bold" />
              ) : (
                <DeviceMobile size={11} weight="bold" />
              )}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}
