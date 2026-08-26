"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getDevice } from "~/lib/device";
import { scriptWordCount } from "~/lib/markdown/blocks";
import {
  DEFAULT_PROMPTER_STATE,
  LIMITS,
  clamp,
  clampSettings,
  normaliseState,
  type PrompterSettings,
  type PrompterState,
} from "~/lib/prompter/state";
import { useSyncLink, type OutgoingMessage } from "~/lib/realtime/link";
import { type Command, type Message, type Role } from "~/lib/realtime/protocol";
import { type ClosedReason } from "~/components/prompter/room-status";
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

/** The driver restates the full room even when nothing is moving. */
const STATE_HEARTBEAT_MS = 2000;
/** How long a locally changed field is protected from the driver's echo. */
const PREVIEW_GRACE_MS = 700;
/** Two devices' clocks disagree; inside this window, do not trust the order. */
const CLOCK_SKEW_TOLERANCE_MS = 3000;
/** Slider drags fire per pixel; the wire only needs about ten a second. */
const SETTINGS_COALESCE_MS = 100;

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
    a.theme === b.theme &&
    a.voiceTracking === b.voiceTracking
  );
}

export function useRoomSession({
  room,
  role,
  onReload,
  onEnded,
  deriveViewState,
  allowVoice = false,
  words = false,
}: {
  room: RoomLike;
  role: Role;
  onReload?: () => void;
  onEnded?: (reason: ClosedReason) => void;
  /**
   * Whether this device is able and willing to listen.
   *
   * The microphone lives on whichever display is driving. A `voice` command
   * from a remote is therefore a request, not an instruction: a display whose
   * browser cannot recognise speech declines it, and the state it broadcasts
   * back is what the remote's button reflects.
   */
  allowVoice?: boolean;
  /**
   * Whether the canvas below is rendering one element per word. Has to match
   * what is passed to `ScriptCanvas`, or the engine measures an index that is
   * not on screen.
   */
  words?: boolean;
  /**
   * The remote shows the same words as the display but at its own type size,
   * column width and orientation; a phone is not a monitor. Because devices
   * sync a text anchor rather than a pixel offset, the two can be laid out
   * completely differently and still sit on the same line.
   */
  deriveViewState?: (state: PrompterState) => PrompterState;
}) {
  const [device] = useState(getDevice);
  const allowVoiceRef = useRef(allowVoice);
  allowVoiceRef.current = allowVoice;
  const [state, setState] = useState<PrompterState>(() =>
    normaliseState({
      ...DEFAULT_PROMPTER_STATE,
      ...room.state,
      // Position, pace and type size are all worth restoring from the saved
      // room. A microphone is not. The row is written every few seconds while
      // a session runs, so a room left with voice tracking on would switch it
      // back on by itself the next time it was opened, which is not a thing a
      // microphone should ever do without being asked.
      voiceTracking: false,
    }),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * Fields this device has just changed locally, and the moment that grace
   * period ends.
   *
   * The driver rebroadcasts the full state about ten times a second. Without
   * this, a value the user is actively dragging is overwritten by every
   * in-flight snapshot carrying the pre-change value, so the control visibly
   * oscillates between the finger and the old setting until the round trip
   * lands. Only the fields being previewed are held back; everything else in
   * the snapshot is applied as normal, and after the window the driver wins.
   */
  const preview = useRef<{ fields: Set<string>; until: number }>({
    fields: new Set(),
    until: 0,
  });

  /** Let an inbound snapshot through, minus anything being previewed here. */
  const reconcile = useCallback((incoming: PrompterState): PrompterState => {
    const { fields, until } = preview.current;
    if (Date.now() > until || fields.size === 0) return incoming;
    const merged = { ...incoming } as Record<string, unknown>;
    const local = stateRef.current as unknown as Record<string, unknown>;
    for (const field of fields) merged[field] = local[field];
    return merged as unknown as PrompterState;
  }, []);

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
    words,
    initialAnchor: room.state.anchor,
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
        // Transport and voice tracking are two pacers for the same text, so
        // reaching for one always puts the other down. Leaving both running
        // would have the clock and the reader fighting over the scroll.
        case "play":
          engine.setPlaying(true);
          engine.setVoiceTarget(null);
          commit({ isPlaying: true, voiceTracking: false });
          return;
        case "pause":
          engine.setPlaying(false);
          engine.setVoiceTarget(null);
          commit({ isPlaying: false, voiceTracking: false });
          return;
        case "toggle": {
          // With voice tracking on, the first press means "stop following me"
          // rather than "start the clock"; otherwise the only way to stop
          // would be to reach for a different control than the one that is
          // obviously the stop button.
          if (stateRef.current.voiceTracking) {
            engine.setPlaying(false);
            engine.setVoiceTarget(null);
            commit({ isPlaying: false, voiceTracking: false });
            return;
          }
          const next = !stateRef.current.isPlaying;
          engine.setPlaying(next);
          commit({ isPlaying: next });
          return;
        }
        case "voice": {
          // Declining is silent by design: the state broadcast that follows
          // every other command still says `voiceTracking: false`, so the
          // device that asked finds out the same way it finds out anything.
          if (command.on && !allowVoiceRef.current) return;
          engine.setPlaying(false);
          if (!command.on) engine.setVoiceTarget(null);
          commit({ isPlaying: false, voiceTracking: command.on });
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
          onEndedRef.current?.("closed");
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
          const settled = reconcile(incoming);
          if (!sameSettings(settled, stateRef.current)) {
            stateRef.current = settled;
            setState(settled);
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
    [applyCommand, broadcastState, engine, reconcile, room.contentRevision],
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
    const wins = otherPrompters.every((peer) => {
      // These two numbers come from two different machines' clocks, which are
      // not the same clock. A few seconds of skew was enough for both displays
      // to conclude they had joined first and drive at once. Anything inside
      // the tolerance is treated as a tie and settled on device key, which
      // both sides evaluate identically.
      const delta = joinedAtRef.current - peer.onlineAt;
      if (Math.abs(delta) < CLOCK_SKEW_TOLERANCE_MS) {
        return device.deviceKey < peer.deviceKey;
      }
      return delta < 0;
    });
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

  /**
   * A heartbeat, so a lost command cannot leave a device lying.
   *
   * Commands are fire-and-forget, and the only thing that used to correct a
   * follower was the driver's anchor broadcast - which a paused display never
   * sends, because the anchor has not moved. So a settings change dropped in
   * flight, or made before any display had connected, left the remote showing
   * a value the display had never taken, with nothing to ever put it right.
   * That is a bad way to find out you are not at the type size you set.
   *
   * Two seconds is far below the rate the anchor path already broadcasts at
   * while rolling, so this costs nothing when it is not needed.
   */
  useEffect(() => {
    if (!driving) return;
    const id = window.setInterval(() => {
      broadcastState(stateRef.current);
    }, STATE_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [broadcastState, driving]);

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

  /* --- Room state: a slow poll that does two jobs ------------------------ */

  /**
   * This runs whether or not the realtime link is healthy, because it answers
   * a question the wire protocol cannot: has the underlying script changed?
   * The person editing it is in the editor, not in the room, so there is
   * nobody on the channel to announce it.
   *
   * When the link is also unreliable it doubles as the transport, at a faster
   * cadence. The snapshot carries pace and play state as well as the anchor,
   * so a follower dead-reckons between polls and the text keeps moving at the
   * right speed rather than freezing and lurching.
   */
  const roomState = api.room.getState.useQuery(
    { roomId: room.id },
    {
      refetchInterval: link.degraded ? 2000 : 5000,
      refetchIntervalInBackground: false,
      staleTime: 0,
      retry: false,
    },
  );

  const usingPolledState = !driving && link.degraded;

  useEffect(() => {
    const data = roomState.data;
    if (!data) return;

    // A newer snapshot of the script exists. Both devices must be rendering
    // identical text before block indices mean anything, so pull it in.
    if (data.contentRevision > room.contentRevision) {
      onReloadRef.current?.();
      return;
    }

    if (!usingPolledState) return;

    engine.receive({
      anchor: data.state.anchor,
      isPlaying: data.state.isPlaying,
      speedWpm: data.state.speedWpm,
    });
    const settled = reconcile(data.state);
    if (!sameSettings(settled, stateRef.current)) {
      stateRef.current = settled;
      setState(settled);
    }
  }, [
    roomState.data,
    usingPolledState,
    engine,
    reconcile,
    room.contentRevision,
  ]);

  /* --- Presence bookkeeping ---------------------------------------------- */

  const heartbeat = api.room.heartbeat.useMutation({
    onSuccess: (result) => {
      // The server refused the beat, so the room ran out its window while this
      // device was asleep or off the network. Nothing else on this path would
      // ever notice: the wire is quiet and the poll only carries state.
      if (!result.live) onEndedRef.current?.("expired");
    },
  });
  const heartbeatRef = useRef(heartbeat.mutate);
  heartbeatRef.current = heartbeat.mutate;

  /**
   * A joined device counts as activity for as long as it is mounted, hidden
   * tab or not - it is in the room, not watching it. But a suspended tab stops
   * its timers, so the first thing a returning device has to do is say it is
   * still here rather than wait out the rest of the interval.
   */
  useEffect(() => {
    const beat = () =>
      heartbeatRef.current({ roomId: room.id, deviceKey: device.deviceKey });
    beat();
    const id = window.setInterval(beat, 45_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [device.deviceKey, room.id]);

  /* --- Public surface ---------------------------------------------------- */

  /**
   * Show a settings change on this device straight away.
   *
   * The sliders and steppers are controlled inputs bound to shared state, and
   * on a follower `dispatch` only put a command on the wire. Until the driver
   * echoed the change back, the control still displayed the old value - so
   * dragging a slider meant the thumb fighting the finger, and on a slow link
   * it read as the control being broken.
   *
   * Applying it locally first is safe because both ends clamp through the same
   * `normaliseState`, so the driver's broadcast confirms this value rather
   * than correcting it. The revision is deliberately not bumped: this is a
   * preview, and the driver remains the authority.
   */
  const previewSettings = useCallback((patch: PrompterSettings) => {
    const clamped = clampSettings(patch);
    const next = normaliseState({ ...stateRef.current, ...clamped });
    stateRef.current = next;
    setState(next);

    const now = Date.now();
    if (preview.current.until < now) preview.current.fields = new Set();
    for (const field of Object.keys(clamped)) preview.current.fields.add(field);
    preview.current.until = now + PREVIEW_GRACE_MS;
  }, []);

  /**
   * Settings commands are coalesced before they go on the wire.
   *
   * A range input fires on every pixel of a drag. Each of those was becoming a
   * command, a commit on the driver and a full state broadcast back - dozens a
   * second, comfortably past the relay's rate limit, which is a good way to
   * make a change look like it did not sync at all. The local preview still
   * updates on every event, so the control stays smooth.
   */
  const pendingPatch = useRef<PrompterSettings | null>(null);
  const settingsTimer = useRef<number | null>(null);

  const flushSettings = useCallback(() => {
    settingsTimer.current = null;
    const patch = pendingPatch.current;
    pendingPatch.current = null;
    if (patch) sendRef.current({ t: "cmd", cmd: { k: "settings", patch } });
  }, []);

  const queueSettings = useCallback(
    (patch: PrompterSettings) => {
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      settingsTimer.current ??= window.setTimeout(
        flushSettings,
        SETTINGS_COALESCE_MS,
      );
    },
    [flushSettings],
  );

  useEffect(
    () => () => {
      if (settingsTimer.current !== null) {
        window.clearTimeout(settingsTimer.current);
        flushSettings();
      }
    },
    [flushSettings],
  );

  const dispatch = useCallback(
    (command: Command) => {
      if (drivingRef.current) {
        applyCommand(command);
        return;
      }
      if (command.k === "settings") {
        const clamped = clampSettings(command.patch);
        previewSettings(clamped);
        queueSettings(clamped);
        return;
      }

      if (command.k === "speed") {
        previewSettings({
          speedWpm: clamp(
            stateRef.current.speedWpm + command.delta,
            LIMITS.speedWpm.min,
            LIMITS.speedWpm.max,
          ),
        });
      } else if (
        command.k === "toggle" ||
        command.k === "play" ||
        command.k === "pause"
      ) {
        // Transport needs local feedback too. Without it the button showed the
        // old state until the driver echoed, and a second impatient tap
        // cancelled the first.
        const next =
          command.k === "toggle"
            ? !stateRef.current.isPlaying
            : command.k === "play";
        const updated = normaliseState({
          ...stateRef.current,
          isPlaying: next,
        });
        stateRef.current = updated;
        setState(updated);
        const now = Date.now();
        if (preview.current.until < now) preview.current.fields = new Set();
        preview.current.fields.add("isPlaying");
        preview.current.until = now + PREVIEW_GRACE_MS;
      }

      sendRef.current({ t: "cmd", cmd: command });
    },
    [applyCommand, previewSettings, queueSettings],
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
    reconnect: link.reconnect,
    /** True when position is coming from the database rather than a peer. */
    polling: usingPolledState,
    announceReload: (contentRevision: number) =>
      sendRef.current({ t: "reload", contentRevision }),
  };
}

export type RoomSession = ReturnType<typeof useRoomSession>;
