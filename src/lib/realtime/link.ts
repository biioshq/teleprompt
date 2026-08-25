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

/**
 * A socket that has died without saying so is the common failure on mobile:
 * the tab is backgrounded, the radio drops, and the client happily reports
 * itself subscribed to a channel that will never deliver anything again.
 *
 * Pings run every 5s, so silence past two of them means something is wrong
 * even though nothing has reported an error.
 */
const WATCHDOG_INTERVAL_MS = 3000;
const STALE_AFTER_MS = 11_000;
const DEAD_AFTER_MS = 16_000;
const REJOIN_COOLDOWN_MS = 8000;
const MAX_BACKOFF_MS = 20_000;
/**
 * `subscribe()` is not guaranteed to call back. If the underlying socket is
 * wedged the join can simply hang, and without a deadline the session sits on
 * "connecting" forever with nothing scheduled to rescue it.
 */
const JOIN_TIMEOUT_MS = 12_000;
/**
 * After this many failed joins the channel is not the problem. Drop the shared
 * socket and let the client build a new one.
 */
const SOCKET_RESET_AFTER_ATTEMPTS = 3;

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
  /** Subscribed, but nothing has arrived for long enough to distrust it. */
  const [stale, setStale] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const meshRef = useRef<PeerMesh | null>(null);
  const seqRef = useRef(0);
  const seenRef = useRef<string[]>([]);
  const seenSetRef = useRef(new Set<string>());
  const lastInboundRef = useRef(0);
  const peersRef = useRef<PresencePeer[]>([]);
  /** Set while a channel effect is live, so the UI can force a rejoin. */
  const reconnectRef = useRef<(() => void) | null>(null);

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

  const rawSend = useCallback(
    (message: Message, options?: { alwaysRelay?: boolean }) => {
      const payload = JSON.stringify(message);
      const mesh = meshRef.current;
      const direct = mesh?.send(payload);

      // Cover anyone the mesh could not reach, and anyone not yet in the mesh at
      // all. Duplicates are harmless — the receiver dedupes on (from, seq).
      const needsRelay =
        options?.alwaysRelay === true || !direct || direct.missing.length > 0;
      if (needsRelay && channelRef.current) {
        void channelRef.current.send({
          type: "broadcast",
          event: "m",
          payload: message,
        });
      }
    },
    [],
  );

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

      // Anything at all from a peer is proof the path is alive, including a
      // duplicate we are about to drop.
      lastInboundRef.current = Date.now();

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
    let attempt = 0;
    let retryTimer: number | null = null;
    let lastRejoinAt = 0;

    const supabase = getRealtimeClient();

    // The mesh outlives individual channels: a relay reconnect should not tear
    // down a working peer-to-peer link.
    const mesh = PeerMesh.supported
      ? new PeerMesh({
          selfKey: deviceKey,
          sendSignal: (to, signal: Signal) => {
            // Signalling always goes over the relay — it is what bootstraps
            // the direct path, so it cannot depend on the direct path.
            void channelRef.current?.send({
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

    const syncPresence = (channel: RealtimeChannel) => {
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
      peersRef.current = next;
      setPeers(next);
      mesh?.syncPeers(next.map((peer) => peer.deviceKey));
    };

    let connecting = false;
    let joinTimer: number | null = null;

    const clearJoinTimer = () => {
      if (joinTimer !== null) {
        window.clearTimeout(joinTimer);
        joinTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled || retryTimer !== null) return;
      // Back off, but never past the point where a session feels abandoned.
      const delay = Math.min(MAX_BACKOFF_MS, 600 * 2 ** attempt);
      attempt += 1;
      retryTimer = window.setTimeout(
        () => {
          retryTimer = null;
          void connect();
        },
        delay + Math.random() * 400,
      );
    };

    const connect = async () => {
      if (cancelled || connecting) return;
      connecting = true;

      try {
        // A scheduled retry would otherwise fire on top of this one and leave
        // two channels racing for the same topic.
        if (retryTimer !== null) {
          window.clearTimeout(retryTimer);
          retryTimer = null;
        }
        clearJoinTimer();
        lastRejoinAt = Date.now();

        const previous = channelRef.current;
        channelRef.current = null;
        if (previous) {
          // Awaited deliberately. Supabase keys channels by topic, so joining
          // again before the leave has completed lets the server process them
          // out of order and drop the new channel - which looks exactly like a
          // reconnect that never finishes.
          try {
            await supabase.removeChannel(previous);
          } catch {
            // Already gone, which is the state we wanted anyway.
          }
        }
        if (cancelled) return;

        if (attempt >= SOCKET_RESET_AFTER_ATTEMPTS) {
          // Several joins have failed in a row; suspect the socket rather than
          // the channel and force the client to build a fresh one.
          try {
            supabase.realtime.disconnect();
            supabase.realtime.connect();
          } catch {
            // Not fatal: the join below will fail and schedule another retry.
          }
        }

        setStatus(attempt === 0 ? "connecting" : "reconnecting");

        const channel = supabase.channel(channelNameFor(channelKey), {
          config: {
            broadcast: { self: false, ack: false },
            presence: { key: deviceKey },
          },
        });
        channelRef.current = channel;

        joinTimer = window.setTimeout(() => {
          joinTimer = null;
          if (cancelled || channelRef.current !== channel) return;
          setStatus("reconnecting");
          scheduleReconnect();
        }, JOIN_TIMEOUT_MS);

        channel
          .on("broadcast", { event: "m" }, ({ payload }) =>
            handleIncoming(payload),
          )
          .on("presence", { event: "sync" }, () => syncPresence(channel))
          .on("presence", { event: "join" }, () => syncPresence(channel))
          .on("presence", { event: "leave" }, () => syncPresence(channel))
          .subscribe((subscribeStatus) => {
            if (cancelled) return;
            // A channel we have already replaced still emits CLOSED as it goes
            // away. Acting on that knocked the healthy replacement back into
            // "reconnecting" and queued another pointless rejoin.
            if (channelRef.current !== channel) return;

            if (subscribeStatus === "SUBSCRIBED") {
              clearJoinTimer();
              attempt = 0;
              lastInboundRef.current = Date.now();
              setStale(false);
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
              subscribeStatus === "TIMED_OUT" ||
              subscribeStatus === "CLOSED"
            ) {
              clearJoinTimer();
              setStatus("reconnecting");
              scheduleReconnect();
            }
          });
      } finally {
        connecting = false;
      }
    };

    reconnectRef.current = () => {
      attempt = 0;
      void connect();
    };

    void connect();

    const ping = window.setInterval(() => {
      if (cancelled) return;
      // Deliberately forced onto the relay as well as any direct channel.
      // The watchdog below treats silence as a dead relay, so if pings only
      // travelled peer-to-peer a perfectly healthy relay would look dead the
      // moment a data channel opened, and the link would rejoin on a loop.
      rawSend(
        {
          t: "ping",
          from: deviceKey,
          seq: seqRef.current++,
          at: Date.now(),
        },
        { alwaysRelay: true },
      );
    }, PING_INTERVAL_MS);

    /**
     * Nothing below reports an error on its own, which is the point: a dead
     * socket looks exactly like a quiet one until you notice that a peer who
     * should be answering pings has not said anything.
     */
    const watchdog = window.setInterval(() => {
      if (cancelled) return;
      if (peersRef.current.length === 0) {
        // Alone in the room, silence is expected.
        setStale(false);
        return;
      }
      const idleFor = Date.now() - lastInboundRef.current;
      setStale(idleFor > STALE_AFTER_MS);
      if (
        idleFor > DEAD_AFTER_MS &&
        Date.now() - lastRejoinAt > REJOIN_COOLDOWN_MS
      ) {
        void connect();
      }
    }, WATCHDOG_INTERVAL_MS);

    const onOnline = () => {
      if (cancelled) return;
      attempt = 0;
      void connect();
    };
    const onVisible = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      // Alone in a room, silence proves nothing: there is nobody to hear from,
      // so `lastInbound` is always ancient and this would rejoin on every
      // single tab switch.
      if (peersRef.current.length === 0) return;
      // Coming back from the background is the moment a stale socket shows up.
      if (Date.now() - lastInboundRef.current > STALE_AFTER_MS) {
        attempt = 0;
        void connect();
      }
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      reconnectRef.current = null;
      window.clearInterval(ping);
      window.clearInterval(watchdog);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      clearJoinTimer();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);

      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) {
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
        void supabase.removeChannel(channel);
      }

      mesh?.close();
      meshRef.current = null;
      peersRef.current = [];
      setPeers([]);
      setDirectPeers([]);
      setLatencyMs(null);
      setStale(false);
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

  /** True when the realtime path cannot be trusted to carry the session. */
  const degraded = status !== "online" || stale;

  /** Force a rejoin now, for a person who has waited long enough. */
  const reconnect = useCallback(() => {
    reconnectRef.current?.();
  }, []);

  return {
    status,
    peers: peersWithTransport,
    transport,
    latencyMs,
    stale,
    degraded,
    send,
    reconnect,
  };
}
