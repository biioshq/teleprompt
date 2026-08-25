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
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 gutter">
        <Link href="/app" aria-label="Teleprompt">
          <Logo byline markClassName="h-8 w-8" />
        </Link>

        <nav className="ml-2 hidden items-center gap-5 sm:flex">
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

        <div className="ml-auto flex items-center gap-4">
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
