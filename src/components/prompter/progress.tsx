"use client";

import { useEffect, useState } from "react";

import { type PrompterEngine } from "~/components/prompter/engine";
import { formatDuration } from "~/lib/prompter/state";
import { cn } from "~/lib/utils";

/**
 * Samples the engine a few times a second. The engine itself runs at 60fps and
 * never touches React; this is the one place a number crosses back over, and it
 * is isolated in its own component so nothing else re-renders with it.
 */
export function useProgress(engine: PrompterEngine) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setProgress(engine.getProgress()), 120);
    return () => window.clearInterval(id);
  }, [engine]);

  return progress;
}

export function ProgressReadout({
  engine,
  totalWords,
  speedWpm,
  className,
  tone = "stage",
}: {
  engine: PrompterEngine;
  totalWords: number;
  speedWpm: number;
  className?: string;
  tone?: "stage" | "paper";
}) {
  const progress = useProgress(engine);
  const totalSeconds = speedWpm > 0 ? (totalWords / speedWpm) * 60 : 0;
  const remaining = Math.max(0, totalSeconds * (1 - progress));

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "font-mono text-[0.6875rem] tabular",
          tone === "stage" ? "text-stage-muted" : "text-muted",
        )}
      >
        {formatDuration(totalSeconds * progress)}
      </span>
      <div
        className={cn(
          "h-[3px] flex-1 overflow-hidden rounded-full",
          tone === "stage" ? "bg-stage-line" : "bg-line",
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Progress through the script"
      >
        <div
          className="h-full origin-left bg-brand transition-[width] duration-150 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span
        className={cn(
          "font-mono text-[0.6875rem] tabular",
          tone === "stage" ? "text-stage-muted" : "text-muted",
        )}
      >
        −{formatDuration(remaining)}
      </span>
    </div>
  );
}
