"use client";

import {
  Broadcast,
  Database,
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
      detail: "Peer-to-peer data channel - nothing in between",
    },
    relay: {
      label: "Relay",
      detail: "Via the realtime relay - no direct route between these devices",
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
  polling = false,
  className,
  tone = "stage",
}: {
  status: LinkStatus;
  transport: TransportMode;
  latencyMs: number | null;
  peers: PresencePeer[];
  /** Position is coming from the database rather than from a peer. */
  polling?: boolean;
  className?: string;
  tone?: "stage" | "paper";
}) {
  const offline = status !== "online";

  const Icon = polling
    ? Database
    : offline
      ? WifiSlash
      : transport === "direct"
        ? Lightning
        : Broadcast;

  const colour = polling
    ? "text-citrine"
    : offline
      ? "text-coral"
      : transport === "direct"
        ? "text-brand"
        : transport === "relay"
          ? "text-blue"
          : tone === "stage"
            ? "text-stage-muted"
            : "text-muted";

  const title = polling
    ? "The realtime channel is not carrying traffic. Following the saved position instead, a couple of seconds behind."
    : offline
      ? "Reconnecting"
      : TRANSPORT_COPY[transport].detail;

  const label = polling
    ? "Catching up"
    : offline
      ? status === "reconnecting"
        ? "Reconnecting"
        : "Connecting"
      : TRANSPORT_COPY[transport].label;

  return (
    <div className={cn("flex items-center gap-2", className)} title={title}>
      <Icon size={14} weight="bold" className={colour} />
      <span
        className={cn(
          "font-mono text-[0.6875rem] tracking-[0.08em] uppercase",
          tone === "stage" ? "text-stage-muted" : "text-muted",
        )}
      >
        {label}
        {latencyMs !== null && !offline && !polling ? (
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
