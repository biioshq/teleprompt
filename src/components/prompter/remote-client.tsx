"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsInLineVertical,
  ArrowsOutLineVertical,
  DeviceMobile,
  Gear,
  Keyboard,
  X,
} from "@phosphor-icons/react/dist/ssr";

import { ConnectionBadge } from "~/components/prompter/connection-badge";
import {
  SettingsPanel,
  SpeedNudge,
  TransportControls,
} from "~/components/prompter/controls";
import { ProgressReadout } from "~/components/prompter/progress";
import {
  ExitLink,
  StageLoading,
  StageMessage,
} from "~/components/prompter/room-status";
import { ScriptCanvas } from "~/components/prompter/script-canvas";
import { useRoomBootstrap } from "~/components/prompter/use-room-bootstrap";
import { useRoomSession } from "~/components/prompter/use-room-session";
import { ShortcutsOverlay } from "~/components/prompter/shortcuts-overlay";
import { useScrub } from "~/components/prompter/use-scrub";
import { Badge } from "~/components/ui/badge";
import { type PrompterState } from "~/lib/prompter/state";
import { mirrorFontSize } from "~/lib/prompter/mirror";
import { useShortcuts } from "~/lib/keyboard/use-shortcuts";
import { useWakeLock } from "~/lib/pwa";

/** Distance a finger may travel before a tap becomes a scrub. */
const TAP_SLOP_PX = 8;

const FONT_STEP = 4;

/** The remote's mirror is full-bleed, so the window is a fair proxy. */
function useViewportWidth() {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 390 : window.innerWidth,
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return width;
}

function buzz(ms = 8) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  navigator.vibrate(ms);
}

export function RemoteClient({ roomId }: { roomId: string }) {
  const { room, isLoading, error, refetch, slow } = useRoomBootstrap(
    roomId,
    "remote",
  );

  if (isLoading && !room) {
    return (
      <StageLoading
        label="Connecting the remote"
        slow={slow}
        onRetry={() => void refetch()}
      />
    );
  }

  // Only a room we never loaded is a dead end. A background refetch that
  // fails mid-session must not unmount the stage: that tears down the engine
  // and the realtime link, and the take comes back as "connecting".
  if (!room) {
    return (
      <StageMessage
        title="Room not available"
        detail={
          error?.message ??
          "This room is not on the signed-in account, or it has ended. Both devices have to be signed in as the same person."
        }
      />
    );
  }

  return <RemoteStage room={room} onReload={() => void refetch()} />;
}

type Room = NonNullable<ReturnType<typeof useRoomBootstrap>["room"]>;

function RemoteStage({ room, onReload }: { room: Room; onReload: () => void }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const viewportWidth = useViewportWidth();

  /**
   * The remote deliberately does *not* render at the display's type size. It
   * shows the same words, laid out for a phone in the hand. This is only
   * possible because devices agree on a text anchor rather than a scroll
   * offset — see `lib/prompter/state.ts`.
   *
   * The size still tracks the room's setting, scaled: resize from either
   * device and both move together.
   */
  const deriveViewState = useCallback(
    (state: PrompterState): PrompterState => ({
      ...state,
      fontSize: mirrorFontSize(state.fontSize, viewportWidth),
      lineHeight: 1.45,
      contentWidth: 100,
      readingLine: 0.32,
      flipHorizontal: false,
      flipVertical: false,
      showReadingLine: true,
      theme: "night",
    }),
    [viewportWidth],
  );

  const session = useRoomSession({
    room,
    role: "remote",
    onReload,
    deriveViewState,
  });
  const {
    state,
    viewState,
    engine,
    viewportRef,
    contentRef,
    dispatch,
    totalWords,
  } = session;

  useWakeLock(true);

  useEffect(() => {
    document.body.dataset.surface = "stage";
    return () => {
      delete document.body.dataset.surface;
    };
  }, []);

  /**
   * Ask the display for the truth whenever one turns up.
   *
   * This used to latch after the first peer of any kind, so a remote that
   * opened before the display - the normal order - asked while nobody was
   * listening and then never asked again.
   */
  const displayCount = session.peers.filter(
    (peer) => peer.role === "prompter",
  ).length;
  const hadDisplay = useRef(false);
  useEffect(() => {
    if (displayCount === 0) {
      hadDisplay.current = false;
      return;
    }
    if (hadDisplay.current) return;
    hadDisplay.current = true;
    dispatch({ k: "requestState" });
  }, [dispatch, displayCount]);

  const command = useCallback(
    (...args: Parameters<typeof dispatch>) => {
      buzz();
      dispatch(...args);
    },
    [dispatch],
  );

  /* --- Keyboard ----------------------------------------------------------- */

  /**
   * A remote is usually a phone, but not always: a tablet with a keyboard case,
   * a laptop acting as the producer's remote, or a presenter clicker paired to
   * either of them all land here. Clickers send Page Up and Page Down, so they
   * work without any setup.
   */
  useShortcuts((action) => {
    switch (action) {
      case "toggle":
        return command({ k: "toggle" });
      case "next":
        return command({ k: "step", blocks: 1 });
      case "previous":
        return command({ k: "step", blocks: -1 });
      case "pageForward":
        return command({ k: "scrub", delta: 0.8 });
      case "pageBack":
        return command({ k: "scrub", delta: -0.8 });
      case "restart":
        return command({ k: "restart" });
      case "faster":
        return command({ k: "speed", delta: 10 });
      case "slower":
        return command({ k: "speed", delta: -10 });
      case "larger":
        return dispatch({
          k: "settings",
          patch: { fontSize: state.fontSize + 4 },
        });
      case "smaller":
        return dispatch({
          k: "settings",
          patch: { fontSize: state.fontSize - 4 },
        });
      case "mirror":
        return dispatch({
          k: "settings",
          patch: { flipHorizontal: !state.flipHorizontal },
        });
      case "settings":
        setShowHelp(false);
        return setShowSettings((open) => !open);
      case "help":
        setShowSettings(false);
        return setShowHelp((open) => !open);
      case "close":
        setShowHelp(false);
        return setShowSettings(false);
      case "fullscreen":
        return;
    }
  });

  /* --- Tap to seek, drag to scrub ---------------------------------------- */

  const gesture = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    moved: boolean;
  } | null>(null);

  const { scrubPixels, beginGesture, endGesture } = useScrub({
    engine,
    driving: false,
    dispatch,
    viewportRef,
  });

  const onPointerDown = (event: React.PointerEvent) => {
    gesture.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const delta = active.lastY - event.clientY;
    active.lastY = event.clientY;

    if (
      !active.moved &&
      Math.abs(event.clientY - active.startY) > TAP_SLOP_PX
    ) {
      active.moved = true;
      // Take local authority so the text tracks the finger immediately,
      // instead of waiting for the display to echo the scrub back.
      beginGesture();
    }
    if (active.moved) scrubPixels(delta);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const active = gesture.current;
    gesture.current = null;
    if (!active) return;

    if (active.moved) {
      endGesture();
      return;
    }

    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-tp-block]",
    );
    if (!target) return;
    const index = Number(target.dataset.tpBlock);
    if (Number.isNaN(index)) return;
    buzz(12);
    dispatch({ k: "seek", anchor: { blockIndex: index, blockFraction: 0 } });
  };

  const waiting = useMemo(
    () => session.peers.filter((peer) => peer.role === "prompter").length === 0,
    [session.peers],
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-stage">
      {/* Header ----------------------------------------------------------- */}
      <header className="flex shrink-0 items-center gap-3 border-b border-stage-line px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <DeviceMobile size={15} weight="bold" className="shrink-0 text-brand" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-stage-ink">
          {room.title}
        </span>
        <ConnectionBadge
          status={session.status}
          transport={session.transport}
          latencyMs={session.latencyMs}
          peers={session.peers}
          polling={session.polling}
          onReconnect={session.reconnect}
        />
        <ExitLink roomId={room.id} />
      </header>

      {waiting ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-stage-line bg-stage-raised px-4 py-3">
          <span className="animate-live inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          <p className="text-[0.8125rem] leading-snug text-stage-muted">
            No display connected yet. Open{" "}
            <span className="font-mono text-stage-ink">{room.code}</span> on the
            device your audience sees.
          </p>
        </div>
      ) : null}

      {/* Mirror ----------------------------------------------------------- */}
      <div
        className="relative min-h-0 flex-1 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          if (gesture.current?.moved) endGesture();
          gesture.current = null;
        }}
      >
        <ScriptCanvas
          content={room.content}
          state={viewState}
          viewportRef={viewportRef}
          contentRef={contentRef}
          interactive
        />

        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() =>
              command({
                k: "settings",
                patch: { fontSize: state.fontSize + FONT_STEP },
              })
            }
            aria-label="Larger text on both screens"
            title="Larger text on both screens"
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-stage-line bg-stage/80 text-stage-muted backdrop-blur transition-colors hover:text-stage-ink active:scale-95"
          >
            <ArrowsOutLineVertical size={15} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() =>
              command({
                k: "settings",
                patch: { fontSize: state.fontSize - FONT_STEP },
              })
            }
            aria-label="Smaller text on both screens"
            title="Smaller text on both screens"
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-stage-line bg-stage/80 text-stage-muted backdrop-blur transition-colors hover:text-stage-ink active:scale-95"
          >
            <ArrowsInLineVertical size={15} weight="bold" />
          </button>
        </div>

        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[0.5625rem] tracking-[0.16em] text-stage-muted uppercase opacity-60">
          Tap a line to jump · drag to scrub
        </p>
      </div>

      {/* Controls --------------------------------------------------------- */}
      <footer className="shrink-0 border-t border-stage-line px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <ProgressReadout
          engine={engine}
          totalWords={totalWords}
          speedWpm={state.speedWpm}
        />

        <div className="mt-4">
          <TransportControls
            isPlaying={state.isPlaying}
            dispatch={command}
            size="lg"
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <SpeedNudge speedWpm={state.speedWpm} dispatch={command} />
          {state.isPlaying ? (
            <Badge tone="brand">Rolling</Badge>
          ) : (
            <Badge tone="stage">Held</Badge>
          )}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
            className="hidden h-10 items-center rounded-full border border-stage-line px-3 text-stage-muted transition-colors hover:text-stage-ink [@media(pointer:fine)]:inline-flex"
          >
            <Keyboard size={15} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-stage-line px-4 text-[0.8125rem] text-stage-muted transition-colors hover:text-stage-ink"
          >
            <Gear size={15} weight="bold" />
            Display
          </button>
        </div>
      </footer>

      <ShortcutsOverlay
        surface="remote"
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* Settings sheet --------------------------------------------------- */}
      {showSettings ? (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/60"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="max-h-[85dvh] w-full overflow-y-auto overscroll-contain rounded-t-xl border-t border-stage-line bg-stage-raised px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stage-ink">
                  Display settings
                </p>
                <p className="mt-0.5 text-[0.75rem] text-stage-muted">
                  These change the other screen, not this one.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label="Close"
                className="text-stage-muted transition-colors hover:text-stage-ink"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <SettingsPanel
              state={state}
              onChange={(patch) => dispatch({ k: "settings", patch })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
