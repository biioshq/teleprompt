"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowsOut,
  Gear,
  Keyboard,
  Monitor,
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
import { ButtonLink } from "~/components/ui/button";
import { useShortcuts } from "~/lib/keyboard/use-shortcuts";
import { useWakeLock } from "~/lib/pwa";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const CHROME_IDLE_MS = 2600;

export function PrompterClient({ roomId }: { roomId: string }) {
  const { room, isLoading, error, refetch } = useRoomBootstrap(
    roomId,
    "prompter",
  );

  if (isLoading && !room) return <StageLoading label="Opening the room" />;

  // Only a room we never loaded is a dead end. A background refetch that
  // fails mid-session must not unmount the stage: that tears down the engine
  // and the realtime link, and the take comes back as "connecting".
  if (!room) {
    return (
      <StageMessage
        title="Room not available"
        detail={
          error?.message ??
          "This room is not on the signed-in account, or it has ended."
        }
      />
    );
  }

  return <PrompterStage room={room} onReload={() => void refetch()} />;
}

type Room = NonNullable<ReturnType<typeof useRoomBootstrap>["room"]>;

function PrompterStage({
  room,
  onReload,
}: {
  room: Room;
  onReload: () => void;
}) {
  const session = useRoomSession({ room, role: "prompter", onReload });
  const {
    state,
    driving,
    engine,
    viewportRef,
    contentRef,
    dispatch,
    totalWords,
  } = session;

  const [showChrome, setShowChrome] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const endRoom = api.room.end.useMutation();

  useWakeLock(true);

  // The stage owns the whole viewport and paints its own background.
  useEffect(() => {
    document.body.dataset.surface = "stage";
    return () => {
      delete document.body.dataset.surface;
    };
  }, []);

  const wake = useCallback(() => {
    setShowChrome(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      // Controls only get out of the way once the text is actually moving.
      if (engine.isPlaying && !showSettings) setShowChrome(false);
    }, CHROME_IDLE_MS);
  }, [engine, showSettings]);

  useEffect(() => {
    wake();
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [wake, state.isPlaying]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen is a nicety; a rejection is not worth surfacing.
    }
  }, []);

  /* --- Keyboard ---------------------------------------------------------- */

  useShortcuts((action) => {
    wake();
    switch (action) {
      case "toggle":
        return dispatch({ k: "toggle" });
      case "next":
        return dispatch({ k: "step", blocks: 1 });
      case "previous":
        return dispatch({ k: "step", blocks: -1 });
      case "pageForward":
        return dispatch({ k: "scrub", delta: 0.8 });
      case "pageBack":
        return dispatch({ k: "scrub", delta: -0.8 });
      case "restart":
        return dispatch({ k: "restart" });
      case "faster":
        return dispatch({ k: "speed", delta: 10 });
      case "slower":
        return dispatch({ k: "speed", delta: -10 });
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
      case "fullscreen":
        return void toggleFullscreen();
      case "settings":
        setShowHelp(false);
        return setShowSettings((open) => !open);
      case "help":
        setShowSettings(false);
        return setShowHelp((open) => !open);
      case "close":
        setShowHelp(false);
        return setShowSettings(false);
    }
  });

  /* --- Wheel and drag scrubbing ------------------------------------------ */

  const dragState = useRef<{ pointerId: number; lastY: number } | null>(null);
  const { scrubPixels, beginGesture, endGesture } = useScrub({
    engine,
    driving,
    dispatch,
    viewportRef,
  });

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      wake();
      scrubPixels(event.deltaY);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [scrubPixels, viewportRef, wake]);

  /* --- Render ------------------------------------------------------------ */

  return (
    <div
      className="relative h-[100dvh] w-full overflow-hidden bg-stage"
      onPointerDown={(event) => {
        wake();
        if (event.pointerType === "mouse" && event.button !== 0) return;
        // A press on the chrome is a press on a control, not a scrub.
        if ((event.target as HTMLElement).closest("header,footer,aside"))
          return;
        dragState.current = {
          pointerId: event.pointerId,
          lastY: event.clientY,
        };
        beginGesture();
      }}
      onPointerMove={(event) => {
        wake();
        const drag = dragState.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const delta = drag.lastY - event.clientY;
        drag.lastY = event.clientY;
        if (delta !== 0) scrubPixels(delta);
      }}
      onPointerUp={() => {
        if (dragState.current) endGesture();
        dragState.current = null;
      }}
      onPointerCancel={() => {
        if (dragState.current) endGesture();
        dragState.current = null;
      }}
    >
      <ScriptCanvas
        content={room.content}
        state={state}
        viewportRef={viewportRef}
        contentRef={contentRef}
      />

      {/* Top bar ---------------------------------------------------------- */}
      <header
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex items-center gap-4 px-5 py-4 transition-opacity duration-300",
          "bg-gradient-to-b from-black/45 to-transparent",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Monitor size={15} weight="bold" className="shrink-0 text-brand" />
          <span className="truncate text-sm font-medium text-stage-ink">
            {room.title}
          </span>
          {!driving ? <Badge tone="stage">Second display</Badge> : null}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <ConnectionBadge
            status={session.status}
            transport={session.transport}
            latencyMs={session.latencyMs}
            peers={session.peers}
            polling={session.polling}
          />
          <span className="hidden font-mono text-[0.6875rem] tracking-[0.2em] text-stage-muted sm:inline">
            {room.code}
          </span>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label="Fullscreen"
            className="text-stage-muted transition-colors hover:text-stage-ink"
          >
            <ArrowsOut size={17} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
            className="text-stage-muted transition-colors hover:text-stage-ink"
          >
            <Keyboard size={17} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((open) => !open)}
            aria-label="Settings"
            aria-pressed={showSettings}
            className={cn(
              "transition-colors",
              showSettings
                ? "text-brand"
                : "text-stage-muted hover:text-stage-ink",
            )}
          >
            <Gear size={17} weight="bold" />
          </button>
          <ExitLink roomId={room.id} />
        </div>
      </header>

      {/* Bottom bar ------------------------------------------------------- */}
      <footer
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 px-5 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity duration-300",
          "bg-gradient-to-t from-black/55 to-transparent",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <ProgressReadout
            engine={engine}
            totalWords={totalWords}
            speedWpm={state.speedWpm}
          />
          <div className="flex items-center justify-between gap-4">
            <SpeedNudge speedWpm={state.speedWpm} dispatch={dispatch} />
            <TransportControls
              isPlaying={state.isPlaying}
              dispatch={dispatch}
            />
            <ButtonLink
              href={`/remote/${room.id}`}
              variant="stage"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Open remote
            </ButtonLink>
          </div>
        </div>
      </footer>

      <ShortcutsOverlay
        surface="prompter"
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* Settings drawer -------------------------------------------------- */}
      {showSettings ? (
        <aside className="absolute top-0 right-0 z-30 flex h-[100dvh] w-full max-w-sm flex-col border-l border-stage-line bg-stage-raised">
          <div className="flex items-center justify-between border-b border-stage-line px-5 py-4">
            <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-stage-muted uppercase">
              Display settings
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              aria-label="Close settings"
              className="text-stage-muted transition-colors hover:text-stage-ink"
            >
              <X size={17} weight="bold" />
            </button>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-6">
            <SettingsPanel
              state={state}
              onChange={(patch) => dispatch({ k: "settings", patch })}
            />

            <div className="mt-8 border-t border-stage-line pt-6">
              <p className="text-[0.8125rem] leading-relaxed text-stage-muted">
                Settings apply to every device in this room. The remote sees the
                same values the moment they change.
              </p>
              <button
                type="button"
                onClick={() => {
                  endRoom.mutate(
                    { roomId: room.id },
                    {
                      onSuccess: () => {
                        window.location.href = room.scriptId
                          ? `/app/scripts/${room.scriptId}`
                          : "/app";
                      },
                    },
                  );
                }}
                disabled={endRoom.isPending}
                className="mt-5 w-full rounded-sm border border-coral px-4 py-2.5 text-sm font-medium text-coral transition-colors hover:bg-coral hover:text-white disabled:opacity-50"
              >
                {endRoom.isPending ? "Ending…" : "End this room"}
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
