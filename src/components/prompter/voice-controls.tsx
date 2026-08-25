"use client";

import {
  Microphone,
  MicrophoneSlash,
  Waveform,
} from "@phosphor-icons/react/dist/ssr";

import { type VoiceState } from "~/components/prompter/use-voice-tracking";
import { VOICE_LANGUAGES } from "~/lib/voice/recognition";
import { cn } from "~/lib/utils";

/* -------------------------------------------------------------------------- */
/* The button                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Arms the microphone.
 *
 * Sits beside the transport rather than in it, because it is not a transport
 * control: it does not start the text moving, it changes what moves it.
 */
export function VoiceButton({
  on,
  busy = false,
  disabled = false,
  onToggle,
  size = "md",
  className,
}: {
  on: boolean;
  /** Starting up, or waiting for a display to confirm. */
  busy?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  size?: "md" | "lg";
  className?: string;
}) {
  const box = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const icon = size === "lg" ? 24 : 20;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      title={
        disabled
          ? "Voice tracking is not available on this device"
          : on
            ? "Stop following your voice"
            : "Follow your voice"
      }
      aria-label={on ? "Stop voice tracking" : "Start voice tracking"}
      className={cn(
        box,
        "inline-flex shrink-0 items-center justify-center rounded-full border transition-colors active:scale-95",
        on
          ? "border-brand bg-brand text-ink"
          : "border-stage-line text-stage-muted hover:border-stage-muted hover:text-stage-ink",
        busy && !on && "animate-live",
        disabled && "cursor-not-allowed opacity-40 hover:border-stage-line",
        className,
      )}
    >
      {disabled ? (
        <MicrophoneSlash size={icon} weight="bold" />
      ) : (
        <Microphone size={icon} weight={on ? "fill" : "bold"} />
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* The readout                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What the display heard, under the script.
 *
 * The words on screen dimming as they are said is the real feedback, and this
 * is the answer to the question that follows the first time it goes wrong:
 * whether it misheard you or simply could not find the line. Both failures
 * look identical without it.
 */
export function VoiceReadout({
  voice,
  className,
}: {
  voice: VoiceState;
  className?: string;
}) {
  const message =
    voice.error ??
    (voice.status === "starting"
      ? "Listening for you…"
      : voice.searching
        ? "Lost the line — say a few words from where you are."
        : voice.transcript);

  const tone = voice.error
    ? "text-coral"
    : voice.searching || !voice.transcript
      ? "text-stage-muted"
      : "text-stage-ink";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-sm border border-stage-line bg-stage/70 px-3 py-2 backdrop-blur",
        className,
      )}
    >
      <Waveform
        size={14}
        weight="bold"
        className={cn(
          "shrink-0",
          voice.error ? "text-coral" : "text-brand",
          voice.status === "listening" && !voice.error && "animate-live",
        )}
      />
      <p
        className={cn("min-w-0 flex-1 truncate text-[0.8125rem]", tone)}
        // Only a failure is announced. Reading a live transcript of what you
        // just said back to you is not help.
        aria-live={voice.error ? "assertive" : "off"}
      >
        {message || "…"}
      </p>
      {voice.totalWords > 0 && !voice.error ? (
        <span className="shrink-0 font-mono text-[0.6875rem] text-stage-muted tabular">
          {voice.spokenWords}/{voice.totalWords}
        </span>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Voice settings                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The voice section of the settings sheet, and the disclosure that has to
 * travel with it.
 *
 * Teleprompt otherwise never sends what you write or say anywhere but your own
 * devices, and this feature does not hold that line: in Chrome and Edge the
 * browser's speech recognition streams the audio to the vendor. That is a
 * material change to what the product does with your voice, so it is stated
 * next to the control rather than only in the documentation. It used to be
 * attached to the switch that enabled the experiment; with no switch left to
 * attach it to, it belongs here.
 */
export function VoicePanel({
  language,
  onLanguageChange,
  listens,
  supported,
  unsupportedReason,
  className,
}: {
  language: string;
  onLanguageChange: (language: string) => void;
  /**
   * Whether this device would be the one holding the microphone.
   *
   * False on a remote, where the button buys something narrower: it asks the
   * display to listen, and marks the spoken words on the mirror. Neither needs
   * recognition in the phone's own browser, so a phone that cannot do it is
   * not blocked from either.
   */
  listens: boolean;
  supported: boolean;
  unsupportedReason: string | null;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <span className="block font-mono text-[0.625rem] tracking-[0.14em] text-stage-muted uppercase">
        Voice
      </span>

      {listens && !supported ? (
        <p className="rounded-sm border border-stage-line p-3 text-[0.75rem] leading-relaxed text-coral">
          {unsupportedReason}
        </p>
      ) : listens ? (
        <>
          <p className="text-[0.75rem] leading-relaxed text-stage-muted">
            Recognition is the browser&rsquo;s own. In Chrome and Edge that
            means the audio goes to the browser vendor&rsquo;s speech service —
            it never reaches Teleprompt, and nothing is recorded or stored, but
            it does leave this device.
          </p>

          <label className="block">
            <span className="mb-1.5 block font-mono text-[0.625rem] tracking-[0.14em] text-stage-muted uppercase">
              Spoken language
            </span>
            <select
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
              className="h-10 w-full rounded-sm border border-stage-line bg-stage px-3 text-[0.8125rem] text-stage-ink"
            >
              {VOICE_LANGUAGES.map((entry) => (
                <option key={entry.tag} value={entry.tag}>
                  {entry.label}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-[0.6875rem] leading-relaxed text-stage-muted">
              Set on this device only. Matching assumes words are separated by
              spaces, so scripts in Chinese, Japanese and Thai will not track
              well.
            </span>
          </label>
        </>
      ) : (
        <p className="text-[0.75rem] leading-relaxed text-stage-muted">
          The microphone lives on the display. The button here asks it to follow
          the reader&rsquo;s voice, and the mirror marks the words already said.
          Language is set on the display.
        </p>
      )}
    </div>
  );
}
