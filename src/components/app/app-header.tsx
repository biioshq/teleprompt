import Image from "next/image";
import Link from "next/link";
import { BookOpen, SignOut } from "@phosphor-icons/react/dist/ssr";

import { Logo } from "~/components/brand/logo";
import { auth } from "~/server/auth";
import { signOutAction } from "~/server/auth/actions";

export async function AppHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 pad-safe-top backdrop-blur-sm">
      {/* The same three tracks the marketing header is built on, so signing in
          does not shunt the navigation off to one side: matching `1fr` edges
          centre the nav on the header itself rather than on whatever the logo
          and the account controls leave over. The bar stays a notch shorter
          than the landing one: app chrome, not a front door. */}
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-6 gutter">
        <Link
          href="/app"
          aria-label="Teleprompt"
          className="justify-self-start"
        >
          <Logo byline markClassName="h-8 w-8" />
        </Link>

        <nav className="hidden items-center gap-5 sm:flex">
          <Link
            href="/app"
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            Scripts
          </Link>
          <Link
            href="/join"
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            Join a room
          </Link>
        </nav>

        {/* Pinned to the third track by hand. Below `sm` the nav is `display:
            none` and so stops being a grid item at all, and auto-placement
            would drop this into the middle track and strand it mid-bar. */}
        <div className="col-start-3 flex items-center gap-4 justify-self-end">
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            <BookOpen size={15} weight="bold" />
            <span className="hidden sm:inline">Docs</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              {user.image ? (
                <Image
                  src={user.image}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full border border-line"
                />
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-[0.6875rem] text-paper">
                  {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center text-faint transition-colors hover:text-coral"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <SignOut size={16} weight="bold" />
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
