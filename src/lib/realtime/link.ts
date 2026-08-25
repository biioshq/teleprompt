"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type RealtimeChannel } from "@supabase/supabase-js";

import { type DistributiveOmit } from "~/lib/types";
import { getRealtimeClient } from "~/lib/supabase/client";
import { PeerMesh } from "~/lib/realtime/peer";
import {
  channelNameFor,
  parseMessage,
  type Message,
  type Role,
  type Signal,
} from "~/lib/realtime/protocol";

export type LinkStatus = "idle" | "connecting" | "online" | "reconnecting";
export type TransportMode = "direct" | "relay" | "alone";

export type PresencePeer = {
  deviceKey: string;
  label: string;
  role: Role;
  platform?: string;
  onlineAt: number;
  /** True when a WebRTC data channel to this peer is open. */
  direct: boolean;
};

export type OutgoingMessage = DistributiveOmit<Message, "from" | "seq">;

type UseSyncLinkOptions = {
  channelKey: string | null;
  deviceKey: string;
  label: string;
  platform?: string;
  role: Role;
  onMessage: (message: Message) => void;
};

const PING_INTERVAL_MS = 5000;
const SEEN_LIMIT = 400;

export function useSyncLink({
  channelKey,
  deviceKey,
  label,
  platform,
  role,
  onMessage,
}: UseSyncLinkOptions) {
  const [status, setStatus] = useState<LinkStatus>("idle");
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [directPeers, setDirectPeers] = useState<string[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const meshRef = useRef<PeerMesh | null>(null);
  const seqRef = useRef(0);
  const seenRef = useRef<string[]>([]);
  const seenSetRef = useRef(new Set<string>());

  // Kept in refs so the effect below never has to re-subscribe when a parent
  // re-renders with a new closure. Re-subscribing mid-take would be visible.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const identityRef = useRef({ label, platform, role });
  identityRef.current = { label, platform, role };

  const remember = useCallback((id: string) => {
    if (seenSetRef.current.has(id)) return false;
    seenSetRef.current.add(id);
    seenRef.current.push(id);
    if (seenRef.current.length > SEEN_LIMIT) {
      const dropped = seenRef.current.shift();
      if (dropped) seenSetRef.current.delete(dropped);
    }
    return true;
  }, []);

  const rawSend = useCallback((message: Message) => {
    const payload = JSON.stringify(message);
    const mesh = meshRef.current;
    const direct = mesh?.send(payload);

    // Cover anyone the mesh could not reach, and anyone not yet in the mesh at
    // all. Duplicates are harmless — the receiver dedupes on (from, seq).
    const needsRelay = !direct || direct.missing.length > 0;
    if (needsRelay && channelRef.current) {
      void channelRef.current.send({
        type: "broadcast",
        event: "m",
        payload: message,
      });
    }
  }, []);

  const send = useCallback(
    (message: OutgoingMessage) => {
      const full = {
        ...message,
        from: deviceKey,
        seq: seqRef.current++,
      } as Message;
      rawSend(full);
    },
    [deviceKey, rawSend],
  );

  const handleIncoming = useCallback(
    (raw: unknown) => {
      const message = parseMessage(raw);
      if (!message) return;
      if (message.from === deviceKey) return;
      if (!remember(`${message.from}:${message.seq}`)) return;

      // Transport-level traffic is answered here and never surfaced upward.
      if (message.t === "ping") {
        rawSend({
          t: "pong",
          from: deviceKey,
          seq: seqRef.current++,
          at: Date.now(),
          echo: message.at,
        });
        return;
      }
      if (message.t === "pong") {
        setLatencyMs(Math.max(0, Date.now() - message.echo));
        return;
      }
      if (message.t === "signal") {
        if (message.to !== deviceKey) return;
        void meshRef.current?.handleSignal(message.from, message.signal);
        return;
      }

      onMessageRef.current(message);
    },
    [deviceKey, rawSend, remember],
  );

  useEffect(() => {
    if (!channelKey) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("connecting");

    const supabase = getRealtimeClient();
    const channel = supabase.channel(channelNameFor(channelKey), {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: deviceKey },
      },
    });
    channelRef.current = channel;

    const mesh = PeerMesh.supported
      ? new PeerMesh({
          selfKey: deviceKey,
          sendSignal: (to, signal: Signal) => {
            // Signalling always goes over the relay — it is what bootstraps
            // the direct path, so it cannot depend on the direct path.
            void channel.send({
              type: "broadcast",
              event: "m",
              payload: {
                t: "signal",
                from: deviceKey,
                seq: seqRef.current++,
                to,
                signal,
              },
            });
          },
          onData: (payload) => {
            try {
              handleIncoming(JSON.parse(payload));
            } catch {
              // Malformed frame from a peer; drop it.
            }
          },
          onPeersChanged: (open) => {
            if (cancelled) return;
            setDirectPeers(open);
          },
        })
      : null;
    meshRef.current = mesh;

    const syncPresence = () => {
      if (cancelled) return;
      const raw = channel.presenceState<{
        label?: string;
        role?: Role;
        platform?: string;
        onlineAt?: number;
      }>();

      const next: PresencePeer[] = [];
      for (const [key, entries] of Object.entries(raw)) {
        if (key === deviceKey) continue;
        const entry = entries[0];
        if (!entry) continue;
        next.push({
          deviceKey: key,
          label: entry.label ?? "Device",
          role: entry.role ?? "remote",
          platform: entry.platform,
          onlineAt: entry.onlineAt ?? Date.now(),
          direct: false,
        });
      }
      next.sort((a, b) => a.onlineAt - b.onlineAt);
      setPeers(next);
      mesh?.syncPeers(next.map((peer) => peer.deviceKey));
    };

    channel
      .on("broadcast", { event: "m" }, ({ payload }) => handleIncoming(payload))
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe((subscribeStatus) => {
        if (cancelled) return;
        if (subscribeStatus === "SUBSCRIBED") {
          setStatus("online");
          // Re-tracked on every successful (re)join, not just the first.
          void channel.track({
            label: identityRef.current.label,
            role: identityRef.current.role,
            platform: identityRef.current.platform,
            onlineAt: Date.now(),
          });
          rawSend({
            t: "hello",
            from: deviceKey,
            seq: seqRef.current++,
            device: {
              deviceKey,
              label: identityRef.current.label,
              role: identityRef.current.role,
              platform: identityRef.current.platform,
            },
          });
          return;
        }
        if (
          subscribeStatus === "CHANNEL_ERROR" ||
          subscribeStatus === "TIMED_OUT"
        ) {
          setStatus("reconnecting");
        }
        if (subscribeStatus === "CLOSED") {
          setStatus("connecting");
        }
      });

    const ping = window.setInterval(() => {
      if (cancelled) return;
      rawSend({
        t: "ping",
        from: deviceKey,
        seq: seqRef.current++,
        at: Date.now(),
      });
    }, PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(ping);
      try {
        void channel.send({
          type: "broadcast",
          event: "m",
          payload: { t: "bye", from: deviceKey, seq: seqRef.current++ },
        });
        void channel.untrack();
      } catch {
        // The socket may already be gone; unsubscribing is what matters.
      }
      mesh?.close();
      meshRef.current = null;
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setPeers([]);
      setDirectPeers([]);
      setLatencyMs(null);
      setStatus("idle");
    };
  }, [channelKey, deviceKey, handleIncoming, rawSend]);

  // Presence carries our role, so a role change has to be republished.
  useEffect(() => {
    if (status !== "online" || !channelRef.current) return;
    void channelRef.current.track({
      label,
      role,
      platform,
      onlineAt: Date.now(),
    });
  }, [label, role, platform, status]);

  const peersWithTransport = useMemo(
    () =>
      peers.map((peer) => ({
        ...peer,
        direct: directPeers.includes(peer.deviceKey),
      })),
    [peers, directPeers],
  );

  const transport: TransportMode =
    peersWithTransport.length === 0
      ? "alone"
      : directPeers.length > 0
        ? "direct"
        : "relay";

  return {
    status,
    peers: peersWithTransport,
    transport,
    latencyMs,
    send,
  };
}
