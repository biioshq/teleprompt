"use client";

import { useState } from "react";
import Link from "next/link";
import { DeviceMobile, Monitor } from "@phosphor-icons/react/dist/ssr";

import { Button, ButtonLink } from "~/components/ui/button";
import { Input, Label } from "~/components/ui/field";
import { normaliseJoinCode } from "~/lib/utils";
import { api } from "~/trpc/react";

export function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(normaliseJoinCode(initialCode));
  const [submitted, setSubmitted] = useState(
    normaliseJoinCode(initialCode).length === 7,
  );

  const lookup = api.room.byCode.useQuery(
    { code },
    { enabled: submitted && code.length === 7, retry: false },
  );

  const room = lookup.data;

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl">Join a room</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
        Type the code shown on the other device. Both devices must be signed in
        to the same account. That is what makes them a pair.
      </p>

      <form
        className="mt-8"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <Label htmlFor="code">Room code</Label>
        <Input
          id="code"
          value={code}
          onChange={(event) => {
            setCode(normaliseJoinCode(event.target.value));
            setSubmitted(false);
          }}
          placeholder="K7M-2QF"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          className="text-center font-mono text-2xl tracking-[0.28em] uppercase"
          aria-describedby="code-help"
        />
        <p id="code-help" className="mt-2 text-[0.75rem] text-faint">
          Six characters. Letters that look like digits are never used.
        </p>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-5 w-full"
          disabled={code.length !== 7 || lookup.isFetching}
        >
          {lookup.isFetching ? "Looking…" : "Find the room"}
        </Button>
      </form>

      {submitted && lookup.error ? (
        <p className="mt-6 rounded-sm border border-coral bg-coral-soft px-4 py-3 text-[0.875rem] leading-relaxed text-coral">
          {lookup.error.message}
        </p>
      ) : null}

      {room ? (
        <section className="mt-8 rounded-sm border border-ink bg-surface p-5 shadow-hard">
          <p className="eyebrow">Found</p>
          <h2 className="mt-2 text-lg">{room.title}</h2>
          <p className="mt-2 text-[0.8125rem] text-muted">
            Pick what this device should do.
          </p>
          <div className="mt-5 grid gap-3">
            <ButtonLink href={`/remote/${room.id}`} variant="brand" size="lg">
              <DeviceMobile size={17} weight="bold" />
              Be the remote
            </ButtonLink>
            <ButtonLink
              href={`/prompter/${room.id}`}
              variant="outline"
              size="lg"
            >
              <Monitor size={17} weight="bold" />
              Be the display
            </ButtonLink>
          </div>
          <Link
            href={`/app/rooms/${room.id}`}
            className="mt-4 inline-block text-[0.8125rem] text-muted underline underline-offset-2 transition-colors hover:text-ink"
          >
            Room details
          </Link>
        </section>
      ) : null}

      <p className="mt-10 text-[0.8125rem] leading-relaxed text-faint">
        No code yet? Open a script from{" "}
        <Link href="/app" className="text-muted underline underline-offset-2">
          your scripts
        </Link>{" "}
        and press Start a session.
      </p>
    </main>
  );
}
