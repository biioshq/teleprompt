"use client";

import { type Signal } from "~/lib/realtime/protocol";
import { shouldInitiateTo } from "~/lib/realtime/protocol";

/**
 * A tiny WebRTC mesh over an existing signalling path.
 *
 * Once two of an account's devices can see each other on the Realtime channel,
 * they try to open a direct data channel and move the high-rate traffic onto
 * it. When that succeeds the scroll position stops making a round trip to a
 * server at all — which on the same Wi-Fi is the difference between a few
 * milliseconds and a few tens of milliseconds of lag between the words on the
 * display and the words on the remote.
 *
 * If it fails — symmetric NAT, a locked-down network, no STUN reachability —
 * nothing breaks. `link.ts` keeps using the relay, and the only observable
 * difference is the connection badge reading "relay" instead of "direct".
 */

export type PeerState = "connecting" | "open" | "failed" | "closed";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

type PeerEntry = {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  state: PeerState;
  polite: boolean;
  /** ICE that arrived before the remote description was set. */
  queuedCandidates: RTCIceCandidateInit[];
  hasRemoteDescription: boolean;
};

export type PeerMeshOptions = {
  selfKey: string;
  sendSignal: (to: string, signal: Signal) => void;
  onData: (raw: string, fromPeer: string) => void;
  onPeersChanged: (open: string[], all: Record<string, PeerState>) => void;
  iceServers?: RTCIceServer[];
};

export class PeerMesh {
  private readonly peers = new Map<string, PeerEntry>();
  private readonly options: PeerMeshOptions;
  private disposed = false;

  constructor(options: PeerMeshOptions) {
    this.options = options;
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

    const wanted = new Set(
      peerKeys.filter((key) => key !== this.options.selfKey),
    );

    for (const key of [...this.peers.keys()]) {
      if (!wanted.has(key)) this.closePeer(key);
    }

    for (const key of wanted) {
      const existing = this.peers.get(key);
      if (existing && existing.state !== "failed") continue;
      if (existing) this.closePeer(key);
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
      if (!current) return;
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        current.state = pc.connectionState === "failed" ? "failed" : "closed";
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
      if (!current) return;
      current.state = "open";
      this.emit();
    };
    dc.onclose = () => {
      const current = this.peers.get(peerKey);
      if (!current) return;
      current.state = "closed";
      this.emit();
    };
    dc.onerror = () => {
      const current = this.peers.get(peerKey);
      if (!current) return;
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

    // A peer may signal us before presence has caught up.
    if (!this.peers.has(fromPeer)) this.openPeer(fromPeer);
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
      // let the next presence sync rebuild it. The relay covers the gap.
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
    return { delivered, missing };
  }

  get openPeers(): string[] {
    return [...this.peers.entries()]
      .filter(([, entry]) => entry.dc?.readyState === "open")
      .map(([key]) => key);
  }

  private closePeer(peerKey: string) {
    const entry = this.peers.get(peerKey);
    if (!entry) return;
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
    this.emit();
  }

  private emit() {
    if (this.disposed) return;
    const all: Record<string, PeerState> = {};
    for (const [key, entry] of this.peers) all[key] = entry.state;
    this.options.onPeersChanged(this.openPeers, all);
  }

  close() {
    this.disposed = true;
    for (const key of [...this.peers.keys()]) this.closePeer(key);
    this.peers.clear();
  }
}
