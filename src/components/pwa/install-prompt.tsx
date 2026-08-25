"use client";

import { DeviceMobile, Export, Plus } from "@phosphor-icons/react/dist/ssr";

import { Button } from "~/components/ui/button";
import { useInstallPrompt } from "~/lib/pwa";
import { cn } from "~/lib/utils";

/**
 * Install affordance. Chromium gets a real button; Safari gets the actual
 * three steps, because there is no API and a button that does nothing is worse
 * than a sentence that tells the truth.
 */
export function InstallPrompt({
  className,
  tone = "paper",
}: {
  className?: string;
  tone?: "paper" | "stage";
}) {
  const { state, install } = useInstallPrompt();

  if (state === "installed") {
    return (
      <p
        className={cn(
          "font-mono text-[0.6875rem] tracking-[0.1em] uppercase",
          tone === "stage" ? "text-stage-muted" : "text-muted",
          className,
        )}
      >
        Installed — running as an app
      </p>
    );
  }

  if (state === "installable") {
    return (
      <Button
        variant={tone === "stage" ? "stage" : "outline"}
        size="md"
        className={className}
        onClick={() => void install()}
      >
        <DeviceMobile size={16} weight="bold" />
        Install Teleprompt
      </Button>
    );
  }

  if (state === "ios-manual") {
    return (
      <div
        className={cn(
          "rounded-sm border border-line bg-surface p-4",
          tone === "stage" && "border-stage-line bg-stage-raised",
          className,
        )}
      >
        <p
          className={cn(
            "font-mono text-[0.6875rem] tracking-[0.12em] uppercase",
            tone === "stage" ? "text-stage-muted" : "text-muted",
          )}
        >
          Install on iPhone or iPad
        </p>
        <ol
          className={cn(
            "mt-3 space-y-2 text-sm",
            tone === "stage" ? "text-stage-ink" : "text-ink-soft",
          )}
        >
          <li className="flex items-center gap-2">
            <Export size={16} weight="bold" className="shrink-0 text-brand" />
            Tap Share in the Safari toolbar
          </li>
          <li className="flex items-center gap-2">
            <Plus size={16} weight="bold" className="shrink-0 text-brand" />
            Choose Add to Home Screen
          </li>
          <li className="flex items-center gap-2">
            <DeviceMobile
              size={16}
              weight="bold"
              className="shrink-0 text-brand"
            />
            Open Teleprompt from the home screen
          </li>
        </ol>
      </div>
    );
  }

  return null;
}
