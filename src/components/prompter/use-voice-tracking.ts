"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type PrompterEngine } from "~/components/prompter/engine";
import { VoiceTracker } from "~/lib/voice/align";
import { buildScriptTokens } from "~/lib/voice/normalise";
import {
  SpeechListener,
  speechSupport,
  type ListenerStatus,
} from "~/lib/voice/recognition";

/**
 * Binds the microphone to the scroll.
 *
 * Three pieces meet here and nowhere else: the recogniser hands over what it
 * heard, the tracker decides where in the script that was, and the engine is
 * told to move there. Everything crossing between them is a word index, which
 * keeps each piece testable on its own — the tracker has no idea a browser
 * exists and the engine has no idea anyone is talking.
 *
 * None of it touches React state on the hot path. A phrase arrives several
 * times a second and only ever results in two DOM attribute writes and a
 * target update; the readout below re-renders on a slow timer instead.
 */

/** How far ahead of the last spoken word the reading line aims. */
const LEAD_WORDS = 1;
/** The readout is for reassurance, not for reading. A few times a second is ample. */
const READOUT_MS = 220;
/** Kept short: it is a confidence check, not a transcript. */
const READOUT_CHARS = 120;
/** About a sixth of a second of frames. Long enough for any first paint. */
const MAX_INDEX_ATTEMPTS = 10;

export type VoiceState = {
  supported: boolean;
  /** Why not, when `supported` is false. */
  unsupportedReason: string | null;
  status: ListenerStatus;
  /** A problem worth showing the reader. */
  error: string | null;
  /** The last words heard, for the strip under the script. */
  transcript: string;
  /** True while the tracker has lost the thread and is searching wider. */
  searching: boolean;
  /** Words matched so far, and how many there are. */
  spokenWords: number;
  totalWords: number;
};

const IDLE: VoiceState = {
  supported: false,
  unsupportedReason: null,
  status: "idle",
  error: null,
  transcript: "",
  searching: false,
  spokenWords: 0,
  totalWords: 0,
};

/**
 * Whether this browser can listen, answered after hydration.
 *
 * Deliberately not answered during render. The server has no `window`, so it
 * would always say no, and a client that says yes on its very first render
 * disagrees with the markup it is hydrating. One frame of "unsupported" costs
 * nothing; a hydration mismatch on the prompter costs a re-render of the whole
 * script.
 */
export function useSpeechSupport() {
  const [support, setSupport] = useState<{
    supported: boolean;
    reason: string | null;
  }>({ supported: false, reason: null });

  useEffect(() => setSupport(speechSupport()), []);

  return support;
}

export function useVoiceTracking({
  engine,
  active,
  content,
  language,
  onStop,
}: {
  engine: PrompterEngine;
  /** Listen. False for every device that is not driving this room. */
  active: boolean;
  /** The script. A change rebuilds the token index from scratch. */
  content: string;
  language: string;
  /**
   * Called when listening stops for a reason the reader did not choose —
   * a blocked microphone, a browser that cannot do it, no connection. The
   * room's shared flag has to come back down or the display sits there
   * claiming to listen.
   */
  onStop?: () => void;
}): VoiceState {
  const support = useSpeechSupport();
  const [state, setState] = useState<VoiceState>(IDLE);

  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  /**
   * Retry counter for the word index.
   *
   * The index is built by reading the DOM, so it only exists once the canvas
   * has rendered its word elements and the engine has measured them. That has
   * normally happened by the time this runs, but "normally" is not a thing to
   * build a take on, so a missing index is retried for a few frames instead of
   * silently producing a tracker that can never match anything.
   */
  const [attempt, setAttempt] = useState(0);

  /**
   * Everything the readout shows, written from callbacks and sampled on a
   * timer. Routing it through `setState` directly would re-render the whole
   * stage on every interim guess — several times a second, mid-take.
   */
  const readout = useRef({
    transcript: "",
    searching: false,
    spokenWords: 0,
    totalWords: 0,
    dirty: false,
  });

  /* --- Placing the reader ------------------------------------------------- */

  const applyCursor = useCallback(
    (spokenWords: number) => {
      engine.setSpokenWords(spokenWords);
      const anchor = engine.anchorForWord(spokenWords + LEAD_WORDS);
      if (anchor) engine.setVoiceTarget(anchor);
      readout.current.spokenWords = spokenWords;
      readout.current.dirty = true;
    },
    [engine],
  );

  /* --- The session -------------------------------------------------------- */

  // Reset the retry counter between sessions rather than inside the session's
  // own teardown: bumping it there would change a dependency of the effect
  // that is tearing down, and restart it.
  useEffect(() => {
    if (!active) setAttempt(0);
  }, [active]);

  useEffect(() => {
    if (!active || !support.supported) return;

    // The index is read out of the DOM, so it can only be built once the
    // canvas has rendered and the engine has measured it. Both have happened
    // by the time an effect runs.
    const words = engine.getWordTexts();
    if (words.length === 0 && attempt < MAX_INDEX_ATTEMPTS) {
      const frame = requestAnimationFrame(() =>
        setAttempt((count) => count + 1),
      );
      return () => cancelAnimationFrame(frame);
    }

    // Start from wherever the reader already is, not from the top: voice
    // tracking is just as likely to be switched on mid-script as before it.
    const startWord = engine.wordAtReadingLine();
    const tracker = new VoiceTracker(buildScriptTokens(words), words.length);
    tracker.reset(startWord, Date.now());

    readout.current = {
      transcript: "",
      searching: false,
      spokenWords: startWord,
      totalWords: words.length,
      dirty: true,
    };
    applyCursor(startWord);

    const settle = () => {
      const update = tracker.advance(Date.now());
      readout.current.searching = update.searching;
      readout.current.dirty = true;
      if (update.moved) applyCursor(update.spokenWords);
    };

    const listener = new SpeechListener({
      onFinal: (transcript) => {
        tracker.pushFinal(transcript);
        readout.current.transcript =
          `${readout.current.transcript} ${transcript}`
            .trim()
            .slice(-READOUT_CHARS);
        settle();
      },
      onInterim: (transcript) => {
        tracker.setInterim(transcript);
        settle();
      },
      onStatus: (status, message) => {
        const error = status === "error" ? message : null;
        setState((previous) =>
          previous.status === status && previous.error === error
            ? previous
            : { ...previous, status, error },
        );
        // A hard stop is not something the reader asked for, so the room's
        // flag has to come down with it rather than leaving a microphone
        // icon lit over a session that ended.
        if (status === "error" && !listener.isArmed) onStopRef.current?.();
      },
    });
    listener.start(language);

    // A hand on the script wins outright. Whatever was said a moment ago
    // described where they *were*, and honouring it now would drag the page
    // back out from under the scrub that just happened.
    const releaseSeek = engine.onSeek(() => {
      const word = engine.wordAtReadingLine();
      tracker.reset(word, Date.now());
      engine.setSpokenWords(word);
      engine.setVoiceTarget(null);
      readout.current.spokenWords = word;
      readout.current.transcript = "";
      readout.current.dirty = true;
    });

    const timer = window.setInterval(() => {
      if (!readout.current.dirty) return;
      readout.current.dirty = false;
      setState((previous) => ({
        ...previous,
        transcript: readout.current.transcript,
        searching: readout.current.searching,
        spokenWords: readout.current.spokenWords,
        totalWords: readout.current.totalWords,
      }));
    }, READOUT_MS);

    return () => {
      window.clearInterval(timer);
      releaseSeek();
      listener.stop();
      engine.clearVoiceMarks();
      setState((previous) => ({
        ...previous,
        status: "idle",
        transcript: "",
        searching: false,
        spokenWords: 0,
      }));
    };
    // `content` is in the list because a script edit invalidates every word
    // index the tracker holds: the whole session has to be rebuilt against the
    // new text rather than patched.
  }, [
    active,
    applyCursor,
    attempt,
    content,
    engine,
    language,
    support.supported,
  ]);

  return {
    ...state,
    supported: support.supported,
    unsupportedReason: support.reason,
  };
}
