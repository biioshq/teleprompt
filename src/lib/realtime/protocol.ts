import { z } from "zod";

import {
  anchorSchema,
  prompterSettingsSchema,
  prompterStateSchema,
} from "~/lib/prompter/state";

/**
 * The wire protocol spoken between an account's devices.
 *
 * Two transports carry it (see `link.ts`):
 *   - Supabase Realtime broadcast, which always works and needs no NAT luck;
 *   - a WebRTC data channel, opened opportunistically between the two devices.
 *
 * Messages are identical on both, and every message is idempotent and carries
 * `(from, seq)` so a receiver can drop the duplicate when a message arrives
 * over both paths.
 */

export const ROLES = ["prompter", "remote"] as const;
export type Role = (typeof ROLES)[number];

export const deviceIdentitySchema = z.object({
  deviceKey: z.string().min(8).max(64),
  label: z.string().min(1).max(80),
  role: z.enum(ROLES),
  platform: z.string().max(160).optional(),
});

export type DeviceIdentity = z.infer<typeof deviceIdentitySchema>;

/* -------------------------------------------------------------------------- */
/* Commands: remote -> prompter                                               */
/* -------------------------------------------------------------------------- */

export const commandSchema = z.discriminatedUnion("k", [
  z.object({ k: z.literal("play") }),
  z.object({ k: z.literal("pause") }),
  z.object({ k: z.literal("toggle") }),
  /** Jump the reading line to an exact place in the text. */
  z.object({ k: z.literal("seek"), anchor: anchorSchema }),
  /** Step whole blocks — the remote's "previous / next line" buttons. */
  z.object({ k: z.literal("step"), blocks: z.number().int().min(-50).max(50) }),
  /** Fine scrub in reading-line heights, for a drag on the remote. */
  z.object({ k: z.literal("scrub"), delta: z.number().min(-40).max(40) }),
  z.object({ k: z.literal("restart") }),
  z.object({ k: z.literal("settings"), patch: prompterSettingsSchema }),
  z.object({
    k: z.literal("speed"),
    delta: z.number().int().min(-100).max(100),
  }),
  /** "I just joined, tell me where you are." */
  z.object({ k: z.literal("requestState") }),
  z.object({ k: z.literal("end") }),
]);

export type Command = z.infer<typeof commandSchema>;

/* -------------------------------------------------------------------------- */
/* WebRTC signalling                                                          */
/* -------------------------------------------------------------------------- */

export const signalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("offer"), sdp: z.string() }),
  z.object({ kind: z.literal("answer"), sdp: z.string() }),
  z.object({
    kind: z.literal("ice"),
    candidate: z.string(),
    sdpMid: z.string().nullable(),
    sdpMLineIndex: z.number().nullable(),
  }),
]);

export type Signal = z.infer<typeof signalSchema>;

/* -------------------------------------------------------------------------- */
/* Envelope                                                                   */
/* -------------------------------------------------------------------------- */

const base = {
  from: z.string().min(8).max(64),
  seq: z.number().int().min(0),
};

export const messageSchema = z.discriminatedUnion("t", [
  /** Announce presence and role on join. */
  z.object({ ...base, t: z.literal("hello"), device: deviceIdentitySchema }),
  z.object({ ...base, t: z.literal("bye") }),

  /** Authoritative snapshot, only ever sent by the prompter. */
  z.object({
    ...base,
    t: z.literal("state"),
    state: prompterStateSchema,
    /** Wall-clock at send, so receivers can age out a stale snapshot. */
    at: z.number().int().min(0),
  }),

  /** Control input, sent by any device that is not the prompter. */
  z.object({ ...base, t: z.literal("cmd"), cmd: commandSchema }),

  /** The room's script snapshot changed; everyone should refetch. */
  z.object({
    ...base,
    t: z.literal("reload"),
    contentRevision: z.number().int().min(1),
  }),

  /** Round-trip latency probe. */
  z.object({ ...base, t: z.literal("ping"), at: z.number().int().min(0) }),
  z.object({
    ...base,
    t: z.literal("pong"),
    at: z.number().int().min(0),
    echo: z.number().int().min(0),
  }),

  /** Peer-to-peer negotiation, addressed to a single device. */
  z.object({
    ...base,
    t: z.literal("signal"),
    to: z.string().min(8).max(64),
    signal: signalSchema,
  }),
]);

export type Message = z.infer<typeof messageSchema>;
export type MessageOfType<T extends Message["t"]> = Extract<Message, { t: T }>;

export function parseMessage(raw: unknown): Message | null {
  const result = messageSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Realtime channel name. The key is a per-room secret, never the room id. */
export function channelNameFor(channelKey: string) {
  return `teleprompt:${channelKey}`;
}

/**
 * Deterministic tie-break for WebRTC: exactly one side of a pair offers.
 * Comparing the two device keys means both peers reach the same answer without
 * another round trip.
 */
export function shouldInitiateTo(selfKey: string, peerKey: string) {
  return selfKey < peerKey;
}
