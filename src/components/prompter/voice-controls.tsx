"use client";

import {
  Microphone,
  MicrophoneSlash,
  Waveform,
} from "@phosphor-icons/react/dist/ssr";

import { type VoiceState } from "~/components/prompter/use-voice-tracking";
import { type Experiments } from "~/lib/experiments";
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
/* The experiment                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The switch itself, and the disclosure that has to travel with it.
 *
 * Teleprompt otherwise never sends what you write or say anywhere but your own
 * devices, and in Chrome and Edge this feature does not hold that line — their
 * speech recognition streams the audio to the browser vendor. That is a
 * material change to what the product does with your voice, so it is stated
 * where the switch is rather than only in the documentation.
 */
export function ExperimentsPanel({
  experiments,
  onChange,
  listens,
  supported,
  unsupportedReason,
  className,
}: {
  experiments: Experiments;
  onChange: <K extends keyof Experiments>(
    key: K,
    value: Experiments[K],
  ) => void;
  /**
   * Whether this device would be the one holding the microphone.
   *
   * False on a remote, where the same switch buys something narrower: a button
   * that asks the display to listen, and the spoken words marked on the
   * mirror. Neither needs recognition in the phone's own browser, so a phone
   * that cannot do it is not blocked from either.
   */
  listens: boolean;
  supported: boolean;
  unsupportedReason: string | null;
  className?: string;
}) {
  const blocked = listens && !supported;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[0.625rem] tracking-[0.14em] text-stage-muted uppercase">
          Experiments
        </span>
        <span className="rounded-xs border-l-2 border-l-brand bg-brand/10 px-2 py-0.5 font-mono text-[0.5625rem] tracking-[0.09em] text-brand uppercase">
          Unfinished
        </span>
      </div>

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-sm border border-stage-line p-3 transition-colors",
          experiments.voiceTracking && !blocked && "border-brand",
          blocked && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
          checked={experiments.voiceTracking}
          disabled={blocked}
          onChange={(event) => onChange("voiceTracking", event.target.checked)}
        />
        <span className="min-w-0">
          <span className="block text-[0.875rem] font-medium text-stage-ink">
            Voice tracking
          </span>
          <span className="mt-1 block text-[0.75rem] leading-relaxed text-stage-muted">
            {listens
              ? "This screen listens, marks the words you have said and scrolls to keep up, instead of moving at a set pace."
              : "Adds a button that asks the display to follow the reader's voice, and marks the words already said on the mirror. The microphone stays on the display."}
          </span>
          {blocked ? (
            <span className="mt-2 block text-[0.75rem] leading-relaxed text-coral">
              {unsupportedReason}
            </span>
          ) : listens ? (
            <span className="mt-2 block text-[0.75rem] leading-relaxed text-stage-muted">
              Recognition is the browser&rsquo;s own. In Chrome and Edge that
              means the audio goes to the browser vendor&rsquo;s speech service
              — it never reaches Teleprompt, and nothing is recorded or stored,
              but it does leave this device.
            </span>
          ) : null}
        </span>
      </label>

      {experiments.voiceTracking && listens && supported ? (
        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.625rem] tracking-[0.14em] text-stage-muted uppercase">
            Spoken language
          </span>
          <select
            value={experiments.voiceLanguage}
            onChange={(event) => onChange("voiceLanguage", event.target.value)}
            className="h-10 w-full rounded-sm border border-stage-line bg-stage px-3 text-[0.8125rem] text-stage-ink"
          >
            {VOICE_LANGUAGES.map((language) => (
              <option key={language.tag} value={language.tag}>
                {language.label}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-[0.6875rem] leading-relaxed text-stage-muted">
            Set on this device only. Matching assumes words are separated by
            spaces, so scripts in Chinese, Japanese and Thai will not track
            well.
          </span>
        </label>
      ) : null}
    </div>
  );
}
