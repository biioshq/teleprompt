"use client";

import {
  ArrowCounterClockwise,
  CaretDown,
  CaretUp,
  Eye,
  EyeSlash,
  FlipHorizontal,
  FlipVertical,
  Pause,
  Play,
  TextAa,
} from "@phosphor-icons/react/dist/ssr";

import {
  LIMITS,
  PROMPTER_THEMES,
  THEME_TOKENS,
  type PrompterSettings,
  type PrompterState,
} from "~/lib/prompter/state";
import { type Command } from "~/lib/realtime/protocol";
import { cn } from "~/lib/utils";

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

export function StageSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  tone = "stage",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  tone?: "stage" | "paper";
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between">
        <span
          className={cn(
            "font-mono text-[0.625rem] tracking-[0.14em] uppercase",
            tone === "stage" ? "text-stage-muted" : "text-muted",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "font-mono text-[0.6875rem] tabular",
            tone === "stage" ? "text-stage-ink" : "text-ink",
          )}
        >
          {format ? format(value) : value}
        </span>
      </span>
      <input
        type="range"
        className={cn("tp-range", tone === "paper" && "on-paper")}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-sm border text-[0.75rem] font-medium transition-colors",
        active
          ? "border-brand bg-brand text-ink"
          : "border-stage-line text-stage-muted hover:border-stage-muted hover:text-stage-ink",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

export function TransportControls({
  isPlaying,
  dispatch,
  size = "md",
  className,
}: {
  isPlaying: boolean;
  dispatch: (command: Command) => void;
  size?: "md" | "lg";
  className?: string;
}) {
  const round = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const primary = size === "lg" ? "h-20 w-20" : "h-14 w-14";

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <button
        type="button"
        onClick={() => dispatch({ k: "restart" })}
        title="Back to the top"
        aria-label="Back to the top"
        className={cn(
          round,
          "inline-flex items-center justify-center rounded-full border border-stage-line text-stage-muted transition-colors hover:border-stage-muted hover:text-stage-ink active:scale-95",
        )}
      >
        <ArrowCounterClockwise size={20} weight="bold" />
      </button>

      <button
        type="button"
        onClick={() => dispatch({ k: "step", blocks: -1 })}
        title="Previous line"
        aria-label="Previous line"
        className={cn(
          round,
          "inline-flex items-center justify-center rounded-full border border-stage-line text-stage-ink transition-colors hover:border-brand hover:text-brand active:scale-95",
        )}
      >
        <CaretUp size={22} weight="bold" />
      </button>

      <button
        type="button"
        onClick={() => dispatch({ k: "toggle" })}
        title={isPlaying ? "Pause" : "Play"}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={cn(
          primary,
          "inline-flex items-center justify-center rounded-full bg-brand text-ink transition-transform active:scale-95",
        )}
      >
        {isPlaying ? (
          <Pause size={size === "lg" ? 32 : 26} weight="fill" />
        ) : (
          <Play size={size === "lg" ? 32 : 26} weight="fill" />
        )}
      </button>

      <button
        type="button"
        onClick={() => dispatch({ k: "step", blocks: 1 })}
        title="Next line"
        aria-label="Next line"
        className={cn(
          round,
          "inline-flex items-center justify-center rounded-full border border-stage-line text-stage-ink transition-colors hover:border-brand hover:text-brand active:scale-95",
        )}
      >
        <CaretDown size={22} weight="bold" />
      </button>

      <button
        type="button"
        onClick={() => dispatch({ k: "scrub", delta: 0.5 })}
        title="Skip forward"
        aria-label="Skip forward half a screen"
        className={cn(
          round,
          "inline-flex items-center justify-center rounded-full border border-stage-line font-mono text-[0.625rem] text-stage-muted transition-colors hover:border-stage-muted hover:text-stage-ink active:scale-95",
        )}
      >
        ½
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export function SettingsPanel({
  state,
  onChange,
  className,
  compact = false,
}: {
  state: PrompterState;
  onChange: (patch: PrompterSettings) => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-5", className)}>
      <StageSlider
        label="Pace"
        value={state.speedWpm}
        min={LIMITS.speedWpm.min}
        max={LIMITS.speedWpm.max}
        step={LIMITS.speedWpm.step}
        onChange={(speedWpm) => onChange({ speedWpm })}
        format={(value) => `${value} wpm`}
      />

      <StageSlider
        label="Type size"
        value={state.fontSize}
        min={LIMITS.fontSize.min}
        max={LIMITS.fontSize.max}
        step={LIMITS.fontSize.step}
        onChange={(fontSize) => onChange({ fontSize })}
        format={(value) => `${value}px`}
      />

      {compact ? null : (
        <>
          <StageSlider
            label="Line height"
            value={state.lineHeight}
            min={LIMITS.lineHeight.min}
            max={LIMITS.lineHeight.max}
            step={LIMITS.lineHeight.step}
            onChange={(lineHeight) => onChange({ lineHeight })}
            format={(value) => value.toFixed(2)}
          />

          <StageSlider
            label="Column width"
            value={state.contentWidth}
            min={LIMITS.contentWidth.min}
            max={LIMITS.contentWidth.max}
            step={LIMITS.contentWidth.step}
            onChange={(contentWidth) => onChange({ contentWidth })}
            format={(value) => `${value}%`}
          />

          <StageSlider
            label="Reading line"
            value={state.readingLine}
            min={LIMITS.readingLine.min}
            max={LIMITS.readingLine.max}
            step={LIMITS.readingLine.step}
            onChange={(readingLine) => onChange({ readingLine })}
            format={(value) => `${Math.round(value * 100)}% down`}
          />
        </>
      )}

      <div>
        <span className="mb-2 block font-mono text-[0.625rem] tracking-[0.14em] text-stage-muted uppercase">
          Surface
        </span>
        <div className="flex gap-2">
          {PROMPTER_THEMES.map((theme) => {
            const tokens = THEME_TOKENS[theme];
            const active = state.theme === theme;
            return (
              <button
                key={theme}
                type="button"
                onClick={() => onChange({ theme })}
                aria-pressed={active}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-sm border px-3 py-2 text-[0.75rem] transition-colors",
                  active
                    ? "border-brand text-stage-ink"
                    : "border-stage-line text-stage-muted hover:border-stage-muted",
                )}
              >
                <span
                  aria-hidden
                  className="inline-block h-4 w-4 shrink-0 rounded-xs border border-stage-line"
                  style={{ backgroundColor: tokens.bg }}
                />
                {tokens.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-2 block font-mono text-[0.625rem] tracking-[0.14em] text-stage-muted uppercase">
          Optics
        </span>
        <div className="flex gap-2">
          <ToggleChip
            active={state.flipHorizontal}
            onClick={() => onChange({ flipHorizontal: !state.flipHorizontal })}
            title="Mirror horizontally, for beam-splitter glass"
          >
            <FlipHorizontal size={16} weight="bold" />
            Mirror
          </ToggleChip>
          <ToggleChip
            active={state.flipVertical}
            onClick={() => onChange({ flipVertical: !state.flipVertical })}
            title="Flip vertically, for an overhead rig"
          >
            <FlipVertical size={16} weight="bold" />
            Flip
          </ToggleChip>
          <ToggleChip
            active={state.showReadingLine}
            onClick={() =>
              onChange({ showReadingLine: !state.showReadingLine })
            }
            title="Show or hide the reading line"
          >
            {state.showReadingLine ? (
              <Eye size={16} weight="bold" />
            ) : (
              <EyeSlash size={16} weight="bold" />
            )}
            Guide
          </ToggleChip>
        </div>
      </div>
    </div>
  );
}

export function SpeedNudge({
  speedWpm,
  dispatch,
}: {
  speedWpm: number;
  dispatch: (command: Command) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-stage-line px-1 py-1">
      <button
        type="button"
        onClick={() => dispatch({ k: "speed", delta: -10 })}
        aria-label="Slower"
        className="h-8 w-8 rounded-full font-mono text-sm text-stage-muted transition-colors hover:text-stage-ink"
      >
        −
      </button>
      <span className="flex items-center gap-1 px-1 font-mono text-[0.6875rem] text-stage-ink tabular">
        <TextAa size={13} weight="bold" className="text-brand" />
        {speedWpm}
      </span>
      <button
        type="button"
        onClick={() => dispatch({ k: "speed", delta: 10 })}
        aria-label="Faster"
        className="h-8 w-8 rounded-full font-mono text-sm text-stage-muted transition-colors hover:text-stage-ink"
      >
        +
      </button>
    </div>
  );
}
