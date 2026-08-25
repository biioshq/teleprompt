"use client";

/**
 * A usable wrapper around the browser's own speech recognition.
 *
 * `SpeechRecognition` is a browser API, not a service we run, so voice
 * tracking needs no key, no server and no bytes through our infrastructure.
 * What it is not is well behaved. Left alone it stops after a pause, stops
 * again after a result, reports "no speech" as an error, and throws if you
 * start it while it is still winding down. A prompter has to survive a
 * twenty-minute take, so everything here exists to keep one long session
 * alive out of a stream of short ones.
 *
 * Worth being straight about, and the UI says so too: in Chrome and Edge this
 * API streams audio to the browser vendor's speech service. It is the
 * browser's connection rather than ours — we never receive the audio and never
 * store a transcript — but it does leave the machine.
 */

type Alternative = { transcript: string };

type RecognitionResult = {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: Alternative;
};

type RecognitionResultList = {
  readonly length: number;
  readonly [index: number]: RecognitionResult;
};

type RecognitionResultEvent = {
  resultIndex: number;
  results: RecognitionResultList;
};

type RecognitionErrorEvent = { error: string; message?: string };

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type RecognitionConstructor = new () => RecognitionInstance;

function constructorFor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/**
 * Whether this browser can do it at all.
 *
 * Also checks the secure context: the API exists over plain HTTP and fails the
 * moment it is started, which is a confusing way to find out.
 */
export function speechSupport(): {
  supported: boolean;
  reason: string | null;
} {
  if (typeof window === "undefined") return { supported: false, reason: null };
  if (!constructorFor()) {
    return {
      supported: false,
      reason:
        "This browser has no built-in speech recognition. Chrome, Edge and Safari do.",
    };
  }
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: "Speech recognition needs a secure connection (https).",
    };
  }
  return { supported: true, reason: null };
}

/**
 * The languages offered in the picker.
 *
 * Deliberately short. The browser accepts any BCP-47 tag, but the alignment
 * this feeds assumes words are separated by spaces, so the list stops at
 * languages where that holds.
 */
export const VOICE_LANGUAGES = [
  { tag: "auto", label: "Browser default" },
  { tag: "en-US", label: "English (US)" },
  { tag: "en-GB", label: "English (UK)" },
  { tag: "en-IN", label: "English (India)" },
  { tag: "en-AU", label: "English (Australia)" },
  { tag: "hi-IN", label: "Hindi" },
  { tag: "es-ES", label: "Spanish" },
  { tag: "fr-FR", label: "French" },
  { tag: "de-DE", label: "German" },
  { tag: "it-IT", label: "Italian" },
  { tag: "pt-BR", label: "Portuguese (Brazil)" },
  { tag: "nl-NL", label: "Dutch" },
] as const;

export function resolveLanguage(tag: string): string {
  if (tag && tag !== "auto") return tag;
  if (typeof navigator === "undefined") return "en-US";
  return navigator.language || "en-US";
}

export type ListenerStatus = "idle" | "starting" | "listening" | "error";

export type ListenerEvents = {
  /** A result the recogniser has committed to. */
  onFinal: (transcript: string) => void;
  /** The guess it is still revising. Replaces the previous interim entirely. */
  onInterim: (transcript: string) => void;
  onStatus: (status: ListenerStatus, message: string | null) => void;
};

/** Quiet restarts, so a pause between sentences is invisible. */
const RESTART_MS = 250;
/** A reachability problem is worth a few attempts and then an explanation. */
const NETWORK_BACKOFF_MS = [800, 2000, 5000];

/**
 * One continuous listening session, assembled from however many the browser
 * feels like giving us.
 */
export class SpeechListener {
  private recognition: RecognitionInstance | null = null;
  private readonly events: ListenerEvents;

  private armed = false;
  private restartTimer: number | null = null;
  private networkFailures = 0;
  private language = "en-US";

  /**
   * How far through this browser session's result list we have read.
   *
   * Results arrive as a growing cumulative list, and an entry that was interim
   * a moment ago is the same entry once it is final. Without this, every
   * revision of a sentence would be committed as if it were a new one, and the
   * same words would be counted three or four times over.
   */
  private consumed = 0;

  constructor(events: ListenerEvents) {
    this.events = events;
  }

  get isArmed() {
    return this.armed;
  }

  start(languageTag: string) {
    this.language = resolveLanguage(languageTag);
    if (this.armed) {
      // A language change mid-session: cycle the recogniser, keep listening.
      this.teardown();
      this.spawn();
      return;
    }
    const { supported, reason } = speechSupport();
    if (!supported) {
      this.events.onStatus("error", reason);
      return;
    }
    this.armed = true;
    this.networkFailures = 0;
    this.events.onStatus("starting", null);
    this.spawn();
  }

  stop() {
    this.armed = false;
    this.clearTimer();
    this.teardown();
    this.events.onStatus("idle", null);
  }

  private clearTimer() {
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private teardown() {
    const recognition = this.recognition;
    this.recognition = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.onstart = null;
    try {
      recognition.abort();
    } catch {
      // Already finished, or never started. Either way there is nothing left
      // to stop.
    }
  }

  private spawn() {
    const Recognition = constructorFor();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = this.language;
    this.consumed = 0;

    recognition.onstart = () => {
      if (!this.armed) return;
      this.networkFailures = 0;
      this.events.onStatus("listening", null);
    };

    recognition.onresult = (event) => {
      if (!this.armed) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? "";
        if (!transcript) continue;
        if (result?.isFinal) {
          if (i >= this.consumed) {
            this.consumed = i + 1;
            this.events.onFinal(transcript);
          }
        } else {
          interim += `${interim ? " " : ""}${transcript}`;
        }
      }
      this.events.onInterim(interim);
    };

    recognition.onerror = (event) => {
      if (!this.armed) return;
      switch (event.error) {
        // Not failures. The recogniser simply gave up on a quiet stretch, or
        // we cancelled it ourselves; `onend` follows and restarts it.
        case "no-speech":
        case "aborted":
          return;

        case "not-allowed":
        case "service-not-allowed":
          this.armed = false;
          this.teardown();
          this.events.onStatus(
            "error",
            "The microphone is blocked for this site. Allow it in the browser's site settings, then turn voice tracking on again.",
          );
          return;

        case "audio-capture":
          this.armed = false;
          this.teardown();
          this.events.onStatus(
            "error",
            "No microphone was found on this device.",
          );
          return;

        case "language-not-supported":
          this.armed = false;
          this.teardown();
          this.events.onStatus(
            "error",
            `This browser cannot recognise ${this.language}. Pick another language in settings.`,
          );
          return;

        case "network":
          this.networkFailures += 1;
          if (this.networkFailures > NETWORK_BACKOFF_MS.length) {
            this.armed = false;
            this.teardown();
            this.events.onStatus(
              "error",
              "The browser's speech service could not be reached. Voice tracking needs a working connection.",
            );
          }
          return;

        default:
          this.events.onStatus(
            "error",
            event.message ?? `Speech recognition failed (${event.error}).`,
          );
          return;
      }
    };

    recognition.onend = () => {
      this.recognition = null;
      if (!this.armed) return;
      // Every browser ends the session on its own schedule — after a pause, a
      // final result, or a fixed timeout. Starting a fresh one is what turns
      // that into one continuous take.
      const delay =
        this.networkFailures > 0
          ? (NETWORK_BACKOFF_MS[this.networkFailures - 1] ?? RESTART_MS)
          : RESTART_MS;
      this.events.onStatus("starting", null);
      this.clearTimer();
      this.restartTimer = window.setTimeout(() => {
        this.restartTimer = null;
        if (this.armed) this.spawn();
      }, delay);
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      // Chrome throws `InvalidStateError` if the previous session has not
      // fully released the microphone yet. Backing off and trying again is
      // the whole remedy.
      this.recognition = null;
      this.clearTimer();
      this.restartTimer = window.setTimeout(() => {
        this.restartTimer = null;
        if (this.armed) this.spawn();
      }, RESTART_MS * 2);
    }
  }
}
