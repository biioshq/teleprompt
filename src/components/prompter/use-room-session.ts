"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getDevice } from "~/lib/device";
import { scriptWordCount } from "~/lib/markdown/blocks";
import {
  DEFAULT_PROMPTER_STATE,
  LIMITS,
  clamp,
  normaliseState,
  type PrompterState,
} from "~/lib/prompter/state";
import { useSyncLink, type OutgoingMessage } from "~/lib/realtime/link";
import { type Command, type Message, type Role } from "~/lib/realtime/protocol";
import { useEngine } from "~/components/prompter/use-engine";
import { api } from "~/trpc/react";

type RoomLike = {
  id: string;
  channelKey: string;
  title: string;
  content: string;
  contentRevision: number;
  state: PrompterState;
};

/** Everything except the live position and its bookkeeping. */
function sameSettings(a: PrompterState, b: PrompterState) {
  return (
    a.isPlaying === b.isPlaying &&
    a.speedWpm === b.speedWpm &&
    a.fontSize === b.fontSize &&
    a.lineHeight === b.lineHeight &&
    a.contentWidth === b.contentWidth &&
    a.readingLine === b.readingLine &&
    a.flipHorizontal === b.flipHorizontal &&
    a.flipVertical === b.flipVertical &&
    a.showReadingLine === b.showReadingLine &&
    a.theme === b.theme
  );
}

export function useRoomSession({
  room,
  role,
  onReload,
  onEnded,
  deriveViewState,
}: {
  room: RoomLike;
  role: Role;
  onReload?: () => void;
  onEnded?: () => void;
  /**
   * The remote shows the same words as the display but at its own type size,
   * column width and orientation — a phone is not a monitor. Because devices
   * sync a text anchor rather than a pixel offset, the two can be laid out
   * completely differently and still sit on the same line.
   */
  deriveViewState?: (state: PrompterState) => PrompterState;
}) {
  const [device] = useState(getDevice);
  const [state, setState] = useState<PrompterState>(() =>
    normaliseState({ ...DEFAULT_PROMPTER_STATE, ...room.state }),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * A room can hold more than one display. Exactly one device drives: the
   * prompter that has been connected longest, chosen by a rule both sides can
   * evaluate independently so there is never a negotiation round trip.
   */
  const [driving, setDriving] = useState(role === "prompter");
  const drivingRef = useRef(driving);
  drivingRef.current = driving;
  const joinedAtRef = useRef(Date.now());

  const viewState = useMemo(
    () => (deriveViewState ? deriveViewState(state) : state),
    [deriveViewState, state],
  );

  const { engine, viewportRef, contentRef } = useEngine({
    content: room.content,
    state: viewState,
    mode: driving ? "drive" : "follow",
    highlight: true,
  });

  const sendRef = useRef<(message: OutgoingMessage) => void>(() => undefined);
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const broadcastState = useCallback(
    (next: PrompterState) => {
      sendRef.current({
        t: "state",
        state: { ...next, anchor: engine.getAnchor() },
        at: Date.now(),
      });
    },
    [engine],
  );

  /** Change settings locally, then tell everyone. */
  const commit = useCallback(
    (patch: Partial<PrompterState>) => {
      const next = normaliseState({
        ...stateRef.current,
        ...patch,
        revision: stateRef.current.revision + 1,
        updatedAt: Date.now(),
      });
      stateRef.current = next;
      setState(next);
      if (drivingRef.current) broadcastState(next);
      return next;
    },
    [broadcastState],
  );

  const applyCommand = useCallback(
    (command: Command) => {
      switch (command.k) {
        case "play":
          engine.setPlaying(true);
          commit({ isPlaying: true });
          return;
        case "pause":
          engine.setPlaying(false);
          commit({ isPlaying: false });
          return;
        case "toggle": {
          const next = !stateRef.current.isPlaying;
          engine.setPlaying(next);
          commit({ isPlaying: next });
          return;
        }
        case "seek":
          engine.seek(command.anchor);
          return;
        case "step":
          engine.stepBlocks(command.blocks);
          return;
        case "scrub":
          engine.scrubBy(command.delta);
          return;
        case "restart":
          engine.setPlaying(false);
          engine.restart();
          commit({ isPlaying: false });
          return;
        case "speed":
          commit({
            speedWpm: clamp(
              stateRef.current.speedWpm + command.delta,
              LIMITS.speedWpm.min,
              LIMITS.speedWpm.max,
            ),
          });
          return;
        case "settings":
          commit(command.patch);
          return;
        case "requestState":
          broadcastState(stateRef.current);
          return;
        case "end":
          onEndedRef.current?.();
          return;
      }
    },
    [broadcastState, commit, engine],
  );

  const handleMessage = useCallback(
    (message: Message) => {
      switch (message.t) {
        case "hello":
          // A device just arrived; hand it the truth immediately rather than
          // making it wait for the next anchor tick.
          if (drivingRef.current) broadcastState(stateRef.current);
          return;

        case "cmd":
          if (drivingRef.current) applyCommand(message.cmd);
          return;

        case "state": {
          if (drivingRef.current) return;
          const incoming = normaliseState(message.state);
          engine.receive({
            anchor: incoming.anchor,
            isPlaying: incoming.isPlaying,
            speedWpm: incoming.speedWpm,
          });
          // Position arrives ten times a second and never goes through React.
          // Only a real settings change is worth a render.
          if (!sameSettings(incoming, stateRef.current)) {
            stateRef.current = incoming;
            setState(incoming);
          }
          return;
        }

        case "reload":
          if (message.contentRevision > room.contentRevision) {
            onReloadRef.current?.();
          }
          return;

        default:
          return;
      }
    },
    [applyCommand, broadcastState, engine, room.contentRevision],
  );

  const link = useSyncLink({
    channelKey: room.channelKey,
    deviceKey: device.deviceKey,
    label: device.label,
    platform: device.platform,
    role,
    onMessage: handleMessage,
  });
  sendRef.current = link.send;

  /* --- Who drives -------------------------------------------------------- */

  useEffect(() => {
    if (role !== "prompter") {
      setDriving(false);
      return;
    }
    const otherPrompters = link.peers.filter(
      (peer) => peer.role === "prompter",
    );
    const wins = otherPrompters.every((peer) =>
      joinedAtRef.current === peer.onlineAt
        ? device.deviceKey < peer.deviceKey
        : joinedAtRef.current < peer.onlineAt,
    );
    setDriving(wins);
  }, [device.deviceKey, link.peers, role]);

  /* --- Outbound position ------------------------------------------------- */

  useEffect(() => {
    if (!driving) return;
    return engine.onAnchor((anchor) => {
      sendRef.current({
        t: "state",
        state: { ...stateRef.current, anchor },
        at: Date.now(),
      });
    });
  }, [driving, engine]);

  useEffect(() => {
    if (!driving) return;
    return engine.onEnd(() => {
      const next = normaliseState({
        ...stateRef.current,
        isPlaying: false,
        revision: stateRef.current.revision + 1,
        updatedAt: Date.now(),
      });
      stateRef.current = next;
      setState(next);
      broadcastState(next);
    });
  }, [broadcastState, driving, engine]);

  /* --- Durable state ----------------------------------------------------- */

  const saveState = api.room.saveState.useMutation();
  const saveRef = useRef(saveState.mutate);
  saveRef.current = saveState.mutate;

  useEffect(() => {
    if (!driving) return;
    const flush = () => {
      saveRef.current({
        roomId: room.id,
        state: normaliseState({
          ...stateRef.current,
          anchor: engine.getAnchor(),
          updatedAt: Date.now(),
        }),
      });
    };
    // Normally this is only a safety net for reloads, so it stays rare enough
    // to be invisible next to the realtime traffic. When the realtime path is
    // unreliable it becomes the transport, and the row a follower polls is
    // only as fresh as the last flush.
    const id = window.setInterval(flush, link.degraded ? 2000 : 6000);
    return () => {
      window.clearInterval(id);
      flush();
    };
  }, [driving, engine, link.degraded, room.id]);

  /* --- Fallback: the database as a slow transport ------------------------ */

  /**
   * Some networks will not carry a WebSocket at all, and a phone that has been
   * in a pocket comes back with a socket that is open but dead. Rather than
   * leave the remote frozen on a stale line, a device that cannot trust the
   * realtime path reads the room's persisted state instead.
   *
   * It is coarse - a couple of seconds behind - but the follower still knows
   * the pace and whether playback is running, so dead reckoning carries it
   * between polls and the text keeps moving at the right speed. The moment the
   * channel recovers, this switches itself off.
   */
  const fallbackEnabled = !driving && link.degraded;
  const fallbackState = api.room.getState.useQuery(
    { roomId: room.id },
    {
      enabled: fallbackEnabled,
      refetchInterval: fallbackEnabled ? 2000 : false,
      refetchIntervalInBackground: false,
      staleTime: 0,
      retry: false,
    },
  );

  useEffect(() => {
    if (!fallbackEnabled) return;
    const data = fallbackState.data;
    if (!data) return;

    engine.receive({
      anchor: data.state.anchor,
      isPlaying: data.state.isPlaying,
      speedWpm: data.state.speedWpm,
    });
    if (!sameSettings(data.state, stateRef.current)) {
      stateRef.current = data.state;
      setState(data.state);
    }
    if (data.contentRevision > room.contentRevision) {
      onReloadRef.current?.();
    }
  }, [fallbackEnabled, fallbackState.data, engine, room.contentRevision]);

  /* --- Presence bookkeeping ---------------------------------------------- */

  const heartbeat = api.room.heartbeat.useMutation();
  const heartbeatRef = useRef(heartbeat.mutate);
  heartbeatRef.current = heartbeat.mutate;

  useEffect(() => {
    const beat = () =>
      heartbeatRef.current({ roomId: room.id, deviceKey: device.deviceKey });
    beat();
    const id = window.setInterval(beat, 45_000);
    return () => window.clearInterval(id);
  }, [device.deviceKey, room.id]);

  /* --- Public surface ---------------------------------------------------- */

  const dispatch = useCallback(
    (command: Command) => {
      if (drivingRef.current) applyCommand(command);
      else sendRef.current({ t: "cmd", cmd: command });
    },
    [applyCommand],
  );

  const totalWords = useMemo(
    () => scriptWordCount(room.content),
    [room.content],
  );

  return {
    device,
    state,
    viewState,
    driving,
    engine,
    viewportRef,
    contentRef,
    dispatch,
    commit,
    totalWords,
    status: link.status,
    peers: link.peers,
    transport: link.transport,
    latencyMs: link.latencyMs,
    degraded: link.degraded,
    /** True when position is coming from the database rather than a peer. */
    polling: fallbackEnabled,
    announceReload: (contentRevision: number) =>
      sendRef.current({ t: "reload", contentRevision }),
  };
}

export type RoomSession = ReturnType<typeof useRoomSession>;
