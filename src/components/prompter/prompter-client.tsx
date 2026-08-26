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
  RoomClosed,
  StageLoading,
  StageMessage,
  type ClosedReason,
} from "~/components/prompter/room-status";
import { ScriptCanvas } from "~/components/prompter/script-canvas";
import { useRoomBootstrap } from "~/components/prompter/use-room-bootstrap";
import { useRoomSession } from "~/components/prompter/use-room-session";
import { ShortcutsOverlay } from "~/components/prompter/shortcuts-overlay";
import { useScrub } from "~/components/prompter/use-scrub";
import {
  useSpeechSupport,
  useVoiceTracking,
} from "~/components/prompter/use-voice-tracking";
import {
  VoiceButton,
  VoicePanel,
  VoiceReadout,
} from "~/components/prompter/voice-controls";
import { Badge } from "~/components/ui/badge";
import { ButtonLink } from "~/components/ui/button";
import { useVoicePreferences } from "~/lib/voice/preferences";
import { useShortcuts } from "~/lib/keyboard/use-shortcuts";
import { useWakeLock } from "~/lib/pwa";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const CHROME_IDLE_MS = 2600;
/** Distance a finger may travel before a tap becomes a scrub. */
const TAP_SLOP_PX = 8;

export function PrompterClient({ roomId }: { roomId: string }) {
  const { room, ended, isLoading, error, refetch, slow } = useRoomBootstrap(
    roomId,
    "prompter",
  );

  /**
   * Held here rather than inside the stage on purpose. A room that is over
   * has to take the stage down with it: the engine, the realtime link, the
   * microphone, the wake lock and the heartbeat all live below this line, and
   * a message painted over the top of them would leave every one of them
   * running against a room that no longer exists.
   */
  const [closed, setClosed] = useState<ClosedReason | null>(null);
  const reason = closed ?? (ended ? "unknown" : null);
  if (reason) {
    return <RoomClosed reason={reason} />;
  }

  if (isLoading && !room) {
    return (
      <StageLoading
        label="Opening the room"
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
          "This room is not on the signed-in account, or it has ended."
        }
      />
    );
  }

  return (
    <PrompterStage
      room={room}
      onReload={() => void refetch()}
      onEnded={setClosed}
    />
  );
}

type Room = NonNullable<ReturnType<typeof useRoomBootstrap>["room"]>;

function PrompterStage({
  room,
  onReload,
  onEnded,
}: {
  room: Room;
  onReload: () => void;
  onEnded: (reason: ClosedReason) => void;
}) {
  const [voicePrefs, setVoiceLanguage] = useVoicePreferences();
  const speech = useSpeechSupport();
  /**
   * The microphone lives on the display, because the display is the thing the
   * reader is looking at and speaking in front of. A remote can ask for it,
   * but only a driving display whose browser can actually recognise speech
   * ever listens.
   */
  const canListen = speech.supported;

  const session = useRoomSession({
    room,
    role: "prompter",
    onReload,
    onEnded,
    allowVoice: canListen,
    /**
     * Always, rather than only while listening. Arming the microphone mid-take
     * would otherwise rebuild the whole script, and a display that cannot
     * listen still marks spoken words when another device is driving with
     * voice on, so "supported" is not the right condition either.
     */
    words: true,
  });
  const {
    state,
    driving,
    engine,
    viewportRef,
    contentRef,
    dispatch,
    totalWords,
  } = session;

  const stopVoice = useCallback(
    () => dispatch({ k: "voice", on: false }),
    [dispatch],
  );

  const listening = state.voiceTracking && driving && canListen;

  /**
   * A display that is not the one listening still shows the spoken words.
   *
   * A room can hold a second display for a co-host, and it follows the
   * driver's anchor like any other device, which is all this needs, because
   * everything above the reading line has been read.
   *
   * Declared above `useVoiceTracking` on purpose. React runs every cleanup
   * before any setup, in hook order, so putting this first means that when
   * the microphone starts, this effect clears its derived marks *before* the
   * voice session writes real ones, and when it stops, the voice session's
   * teardown runs before this effect takes the marks back over. The other
   * order wipes the marks a moment after they are set.
   */
  useEffect(() => {
    engine.setSpokenFollowsPosition(state.voiceTracking && !listening);
  }, [engine, listening, state.voiceTracking]);

  const voice = useVoiceTracking({
    engine,
    active: listening,
    content: room.content,
    language: voicePrefs.language,
    onStop: stopVoice,
  });

  /**
   * Playback moved to a display that cannot listen: its browser has no
   * recognition. Nobody is holding the microphone, so the room should stop
   * saying that somebody is.
   */
  useEffect(() => {
    if (state.voiceTracking && driving && !canListen) {
      dispatch({ k: "voice", on: false });
    }
  }, [canListen, dispatch, driving, state.voiceTracking]);

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
      case "voice":
        // Turning it off is always allowed: a display that cannot listen can
        // still be the one that stops the room claiming it is.
        if (!canListen && !state.voiceTracking) return;
        return dispatch({ k: "voice", on: !state.voiceTracking });
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

  const dragState = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
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
      // `touch-none` is load-bearing on a tablet: without it the browser
      // claims a vertical drag as a page scroll or a pull-to-refresh and
      // cancels the pointer stream mid-scrub. `select-none` stops a long press
      // selecting the script and raising the copy callout.
      className="relative h-[100dvh] w-full touch-none overflow-hidden bg-stage select-none"
      onPointerDown={(event) => {
        wake();
        if (event.pointerType === "mouse" && event.button !== 0) return;
        // A press on the chrome is a press on a control, not a scrub.
        if ((event.target as HTMLElement).closest("header,footer,aside"))
          return;
        dragState.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          lastY: event.clientY,
          moved: false,
        };
        beginGesture();
      }}
      onPointerMove={(event) => {
        wake();
        const drag = dragState.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const delta = drag.lastY - event.clientY;
        drag.lastY = event.clientY;
        if (Math.abs(event.clientY - drag.startY) > TAP_SLOP_PX) {
          drag.moved = true;
        }
        if (drag.moved && delta !== 0) scrubPixels(delta);
      }}
      onPointerUp={(event) => {
        const drag = dragState.current;
        dragState.current = null;
        if (!drag) return;
        endGesture();
        // With no cursor there is nothing to "move" to bring the controls
        // back, and every touch would otherwise scrub. A tap that goes
        // nowhere toggles the chrome instead.
        if (!drag.moved && event.pointerType !== "mouse") {
          setShowChrome((visible) => !visible);
        }
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
        words
      />

      {/* Top bar ---------------------------------------------------------- */}
      <header
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex items-center gap-4 transition-opacity duration-300",
          "pt-[calc(1rem+env(safe-area-inset-top))] pr-[calc(1.25rem+env(safe-area-inset-right))] pb-4 pl-[calc(1.25rem+env(safe-area-inset-left))]",
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
          {state.voiceTracking ? <Badge tone="brand">Listening</Badge> : null}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <ConnectionBadge
            status={session.status}
            transport={session.transport}
            latencyMs={session.latencyMs}
            peers={session.peers}
            polling={session.polling}
            onReconnect={session.reconnect}
          />
          <span className="hidden font-mono text-[0.6875rem] tracking-[0.2em] text-stage-muted sm:inline">
            {room.code}
          </span>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label="Fullscreen"
            className="inline-flex h-11 w-11 items-center justify-center text-stage-muted transition-colors hover:text-stage-ink"
          >
            <ArrowsOut size={17} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
            className="inline-flex h-11 w-11 items-center justify-center text-stage-muted transition-colors hover:text-stage-ink"
          >
            <Keyboard size={17} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((open) => !open)}
            aria-label="Settings"
            aria-pressed={showSettings}
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center transition-colors",
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
          "absolute inset-x-0 bottom-0 z-20 pt-10 gutter pb-[calc(1rem+env(safe-area-inset-bottom))] transition-opacity duration-300",
          "bg-gradient-to-t from-black/55 to-transparent",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {listening ? <VoiceReadout voice={voice} /> : null}
          <ProgressReadout
            engine={engine}
            totalWords={totalWords}
            speedWpm={state.speedWpm}
          />
          {/* Same reason as the remote: a phone used as the display cannot fit
              the transport, the pace and the microphone on one line. */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 sm:justify-between">
            <SpeedNudge speedWpm={state.speedWpm} dispatch={dispatch} />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <TransportControls
                isPlaying={state.isPlaying}
                dispatch={dispatch}
              />
              <VoiceButton
                on={state.voiceTracking}
                busy={voice.status === "starting"}
                disabled={!speech.supported}
                onToggle={() =>
                  dispatch({ k: "voice", on: !state.voiceTracking })
                }
              />
            </div>
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
        <aside className="absolute top-0 right-0 z-30 flex h-[100dvh] w-full max-w-sm flex-col border-l border-stage-line bg-stage-raised pad-safe-top pr-[env(safe-area-inset-right)] pad-safe-bottom">
          <div className="flex items-center justify-between border-b border-stage-line px-5 py-4">
            <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-stage-muted uppercase">
              Display settings
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              aria-label="Close settings"
              className="inline-flex h-11 w-11 items-center justify-center text-stage-muted transition-colors hover:text-stage-ink"
            >
              <X size={17} weight="bold" />
            </button>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 py-6">
            <SettingsPanel
              state={state}
              onChange={(patch) => dispatch({ k: "settings", patch })}
            />

            <div className="mt-8 border-t border-stage-line pt-6">
              <VoicePanel
                language={voicePrefs.language}
                onLanguageChange={setVoiceLanguage}
                listens
                supported={speech.supported}
                unsupportedReason={speech.reason}
              />
            </div>

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
