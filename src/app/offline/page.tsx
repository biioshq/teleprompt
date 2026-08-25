import { type Metadata } from "next";

import { Mark } from "~/components/brand/logo";
import { ButtonLink } from "~/components/ui/button";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-6 pr-[calc(1.5rem+env(safe-area-inset-right))] pl-[calc(1.5rem+env(safe-area-inset-left))]">
      <div className="w-full max-w-md text-center">
        <Mark className="mx-auto h-12 w-12" />
        <h1 className="mt-8 text-3xl">You are offline</h1>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
          Teleprompt keeps its shell on your device, but a live room needs a
          connection: the two devices have to find each other before they can
          talk directly.
        </p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          Scripts you already opened are still in this browser&rsquo;s cache.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/app" variant="primary">
            Try again
          </ButtonLink>
          <ButtonLink href="/docs/troubleshooting" variant="outline">
            Troubleshooting
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
