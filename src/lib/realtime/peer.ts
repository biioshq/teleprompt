"use client";

import { type Signal } from "~/lib/realtime/protocol";
import { shouldInitiateTo } from "~/lib/realtime/protocol";

/**
 * A tiny WebRTC mesh over an existing signalling path.
 *
 * Once two of an account's devices can see each other on the Realtime channel,
 * they try to open a direct data channel and move the high-rate traffic onto
 * it. When that succeeds the scroll position stops making a round trip to a
 * server at all, which on the same Wi-Fi is the difference between a few
 * milliseconds and a few tens of milliseconds of lag between the words on the
 * display and the words on the remote.
 *
 * If it fails (symmetric NAT, a locked-down network, no STUN reachability),
 * nothing breaks. `link.ts` keeps using the relay, and the only observable
 * difference is the connection badge reading "relay" instead of "direct".
 *
 * Everything about retrying lives here, and it has to, because signalling is
 * carried by a channel that legitimately comes and goes. An offer or an ICE
 * candidate sent while the relay is between subscriptions is simply gone;
 * there is no acknowledgement and no redelivery. A negotiation that stalls for
 * that reason looks exactly like one that stalled for any other, so rather
 * than trying to detect the cause, a peer that has not opened within a
 * deadline is torn down and built again.
 */

export type PeerState =
  "connecting" | "open" | "failed" | "closed" | "retrying";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

/**
 * On the same Wi-Fi a data channel opens almost immediately, because host
 * candidates need no server at all. Eight seconds is far past that and still
 * short enough that a lost offer is recovered from before anyone gives up on
 * it and reloads the page.
 */
const NEGOTIATION_TIMEOUT_MS = 8000;
/** How often the mesh re-examines itself, independent of presence events. */
const RETRY_TICK_MS = 3000;
/**
 * After this many attempts the pair is treated as genuinely unable to reach
 * each other. The relay carries the session perfectly well, so the right
 * behaviour is to stop burning connections rather than to keep trying forever.
 */
const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [0, 1000, 3000, 7000, 15_000];

type PeerEntry = {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  state: PeerState;
  polite: boolean;
  /** ICE that arrived before the remote description was set. */
  queuedCandidates: RTCIceCandidateInit[];
  hasRemoteDescription: boolean;
  startedAt: number;
};

/** Kept per peer key, so it survives the connection being torn down. */
type Attempt = { count: number; nextAt: number };

export type PeerMeshOptions = {
  selfKey: string;
  sendSignal: (to: string, signal: Signal) => void;
  onData: (raw: string, fromPeer: string) => void;
  onPeersChanged: (open: string[], all: Record<string, PeerState>) => void;
  iceServers?: RTCIceServer[];
};

export class PeerMesh {
  private readonly peers = new Map<string, PeerEntry>();
  private readonly attempts = new Map<string, Attempt>();
  private wanted = new Set<string>();
  private readonly options: PeerMeshOptions;
  private ticker: number | null = null;
  private disposed = false;

  constructor(options: PeerMeshOptions) {
    this.options = options;
    if (PeerMesh.supported && typeof window !== "undefined") {
      // Presence events are not a reliable heartbeat: a peer list that never
      // changes again would leave a stalled negotiation stalled forever.
      this.ticker = window.setInterval(() => this.reconcile(), RETRY_TICK_MS);
    }
  }

  static get supported() {
    return (
      typeof window !== "undefined" &&
      typeof window.RTCPeerConnection === "function"
    );
  }

  /** Reconcile the mesh against the current presence list. */
  syncPeers(peerKeys: string[]) {
    if (this.disposed || !PeerMesh.supported) return;
    this.wanted = new Set(
      peerKeys.filter((key) => key !== this.options.selfKey),
    );
    this.reconcile();
  }

  private reconcile() {
    if (this.disposed || !PeerMesh.supported) return;
    const now = Date.now();

    for (const key of [...this.peers.keys()]) {
      if (!this.wanted.has(key)) {
        this.closePeer(key);
        this.attempts.delete(key);
      }
    }
    for (const key of [...this.attempts.keys()]) {
      if (!this.wanted.has(key)) this.attempts.delete(key);
    }

    for (const key of this.wanted) {
      const entry = this.peers.get(key);

      if (entry?.state === "open") continue;

      if (entry) {
        const stalled =
          entry.state === "connecting" &&
          now - entry.startedAt > NEGOTIATION_TIMEOUT_MS;
        const broken = entry.state === "failed" || entry.state === "closed";
        if (!stalled && !broken) continue;
        this.closePeer(key, "retrying");
      }

      const attempt = this.attempts.get(key) ?? { count: 0, nextAt: 0 };
      if (attempt.count >= MAX_ATTEMPTS) continue;
      if (now < attempt.nextAt) continue;

      this.attempts.set(key, {
        count: attempt.count + 1,
        nextAt:
          now +
          (BACKOFF_MS[Math.min(attempt.count, BACKOFF_MS.length - 1)] ?? 0) +
          NEGOTIATION_TIMEOUT_MS,
      });
      this.openPeer(key);
    }
  }

  private openPeer(peerKey: string) {
    const initiator = shouldInitiateTo(this.options.selfKey, peerKey);
    const pc = new RTCPeerConnection({
      iceServers: this.options.iceServers ?? DEFAULT_ICE_SERVERS,
    });

    const entry: PeerEntry = {
      pc,
      dc: null,
      state: "connecting",
      polite: !initiator,
      queuedCandidates: [],
      hasRemoteDescription: false,
      startedAt: Date.now(),
    };
    this.peers.set(peerKey, entry);

    pc.onicecandidate = (event) => {
      const candidate = event.candidate;
      if (!candidate?.candidate) return;
      this.options.sendSignal(peerKey, {
        kind: "ice",
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid ?? null,
        sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      });
    };

    pc.onconnectionstatechange = () => {
      const current = this.peers.get(peerKey);
      if (!current || current.pc !== pc) return;
      if (pc.connectionState === "failed") {
        current.state = "failed";
        this.emit();
      } else if (pc.connectionState === "closed") {
        current.state = "closed";
        this.emit();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const current = this.peers.get(peerKey);
      if (!current || current.pc !== pc) return;
      // Rebuilding beats an ICE restart here: it is one code path instead of
      // two, and the retry machinery already exists.
      if (pc.iceConnectionState === "failed") {
        current.state = "failed";
        this.emit();
      }
    };

    if (initiator) {
      const dc = pc.createDataChannel("teleprompt", { ordered: true });
      this.attachChannel(peerKey, dc);
      void this.negotiate(peerKey);
    } else {
      pc.ondatachannel = (event) => this.attachChannel(peerKey, event.channel);
    }

    this.emit();
  }

  private attachChannel(peerKey: string, dc: RTCDataChannel) {
    const entry = this.peers.get(peerKey);
    if (!entry) return;
    entry.dc = dc;

    dc.onopen = () => {
      const current = this.peers.get(peerKey);
      if (!current || current.dc !== dc) return;
      current.state = "open";
      // A pair that has connected once has proved it can, so let it start
      // from scratch if it ever drops.
      this.attempts.delete(peerKey);
      this.emit();
    };
    dc.onclose = () => {
      const current = this.peers.get(peerKey);
      if (!current || current.dc !== dc) return;
      current.state = "closed";
      this.emit();
    };
    dc.onerror = () => {
      const current = this.peers.get(peerKey);
      if (!current || current.dc !== dc) return;
      current.state = "failed";
      this.emit();
    };
    dc.onmessage = (event) => {
      if (typeof event.data === "string") {
        this.options.onData(event.data, peerKey);
      }
    };
  }

  private async negotiate(peerKey: string) {
    const entry = this.peers.get(peerKey);
    if (!entry) return;
    try {
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      if (!entry.pc.localDescription) return;
      this.options.sendSignal(peerKey, {
        kind: "offer",
        sdp: entry.pc.localDescription.sdp,
      });
    } catch {
      entry.state = "failed";
      this.emit();
    }
  }

  async handleSignal(fromPeer: string, signal: Signal) {
    if (this.disposed || !PeerMesh.supported) return;
    if (fromPeer === this.options.selfKey) return;

    // A peer may signal us before presence has caught up.
    if (!this.peers.has(fromPeer)) {
      this.wanted.add(fromPeer);
      this.openPeer(fromPeer);
    }
    const entry = this.peers.get(fromPeer);
    if (!entry) return;

    try {
      if (signal.kind === "offer") {
        await entry.pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });
        entry.hasRemoteDescription = true;
        await this.drainCandidates(fromPeer);
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        if (!entry.pc.localDescription) return;
        this.options.sendSignal(fromPeer, {
          kind: "answer",
          sdp: entry.pc.localDescription.sdp,
        });
        return;
      }

      if (signal.kind === "answer") {
        if (entry.pc.signalingState !== "have-local-offer") return;
        await entry.pc.setRemoteDescription({
          type: "answer",
          sdp: signal.sdp,
        });
        entry.hasRemoteDescription = true;
        await this.drainCandidates(fromPeer);
        return;
      }

      const candidate: RTCIceCandidateInit = {
        candidate: signal.candidate,
        sdpMid: signal.sdpMid ?? undefined,
        sdpMLineIndex: signal.sdpMLineIndex ?? undefined,
      };
      if (!entry.hasRemoteDescription) {
        entry.queuedCandidates.push(candidate);
        return;
      }
      await entry.pc.addIceCandidate(candidate);
    } catch {
      // A negotiation that goes wrong is recoverable: mark the peer failed and
      // let the next reconcile rebuild it. The relay covers the gap.
      entry.state = "failed";
      this.emit();
    }
  }

  private async drainCandidates(peerKey: string) {
    const entry = this.peers.get(peerKey);
    if (!entry) return;
    const queued = entry.queuedCandidates;
    entry.queuedCandidates = [];
    for (const candidate of queued) {
      try {
        await entry.pc.addIceCandidate(candidate);
      } catch {
        // A single unusable candidate is not fatal to the connection.
      }
    }
  }

  /**
   * Send to every peer with an open channel. Returns the peers that could not
   * be reached directly, so the caller can cover them over the relay.
   */
  send(payload: string): { delivered: string[]; missing: string[] } {
    const delivered: string[] = [];
    const missing: string[] = [];
    for (const [key, entry] of this.peers) {
      if (entry.dc?.readyState === "open") {
        try {
          entry.dc.send(payload);
          delivered.push(key);
          continue;
        } catch {
          missing.push(key);
          continue;
        }
      }
      missing.push(key);
    }
    // A peer we have not built a connection for at all is still unreachable
    // directly, and the caller has to know to relay to it.
    for (const key of this.wanted) {
      if (!this.peers.has(key)) missing.push(key);
    }
    return { delivered, missing };
  }

  get openPeers(): string[] {
    return [...this.peers.entries()]
      .filter(([, entry]) => entry.dc?.readyState === "open")
      .map(([key]) => key);
  }

  private closePeer(peerKey: string, finalState?: PeerState) {
    const entry = this.peers.get(peerKey);
    if (!entry) return;
    // Drop the handlers first: tearing the connection down fires state changes
    // that would otherwise write over the entry replacing it.
    entry.pc.onicecandidate = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.oniceconnectionstatechange = null;
    entry.pc.ondatachannel = null;
    if (entry.dc) {
      entry.dc.onopen = null;
      entry.dc.onclose = null;
      entry.dc.onerror = null;
      entry.dc.onmessage = null;
    }
    try {
      entry.dc?.close();
    } catch {
      // Already gone.
    }
    try {
      entry.pc.close();
    } catch {
      // Already gone.
    }
    this.peers.delete(peerKey);
    if (finalState) {
      // Surfaced so the UI can say "still trying" rather than implying the
      // relay is the final answer.
      this.emit({ [peerKey]: finalState });
    } else {
      this.emit();
    }
  }

  private emit(extra?: Record<string, PeerState>) {
    if (this.disposed) return;
    const all: Record<string, PeerState> = { ...extra };
    for (const [key, entry] of this.peers) all[key] = entry.state;
    this.options.onPeersChanged(this.openPeers, all);
  }

  close() {
    this.disposed = true;
    if (this.ticker !== null && typeof window !== "undefined") {
      window.clearInterval(this.ticker);
    }
    this.ticker = null;
    for (const key of [...this.peers.keys()]) this.closePeer(key);
    this.peers.clear();
    this.attempts.clear();
    this.wanted.clear();
  }
}
