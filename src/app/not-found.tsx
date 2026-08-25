import Link from "next/link";

import { Mark } from "~/components/brand/logo";
import { ButtonLink } from "~/components/ui/button";

export default function NotFound() {
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center px-6 pr-[calc(1.5rem+env(safe-area-inset-right))] pl-[calc(1.5rem+env(safe-area-inset-left))]">
      <span aria-hidden className="grain-layer" />
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex">
          <Mark className="mx-auto h-11 w-11" />
        </Link>
        <p className="mt-8 eyebrow">404</p>
        <h1 className="mt-4 text-3xl">This page is not in the script</h1>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
          The link may be old, or the room it pointed at may have ended. Rooms
          close themselves after twelve quiet hours.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/app" variant="primary">
            Your scripts
          </ButtonLink>
          <ButtonLink href="/docs" variant="outline">
            Documentation
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
