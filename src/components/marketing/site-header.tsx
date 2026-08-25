import Link from "next/link";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr";

import { Logo } from "~/components/brand/logo";
import { ButtonLink } from "~/components/ui/button";
import { SITE } from "~/lib/site";
import { auth } from "~/server/auth";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
        <Link href="/" aria-label={SITE.name}>
          <Logo wordmarkClassName="text-[1.125rem]" markClassName="h-8 w-8" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/#how"
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            How it works
          </Link>
          <Link
            href="/#sync"
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            The sync
          </Link>
          <Link
            href="/docs"
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            Docs
          </Link>
          <Link
            href="/open-source"
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            Open source
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <a
            href={SITE.repo}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Teleprompt on GitHub"
            className="hidden text-muted transition-colors hover:text-ink sm:inline-flex"
          >
            <GithubLogo size={19} weight="bold" />
          </a>
          <ButtonLink
            href={session?.user ? "/app" : "/signin"}
            variant="primary"
            size="sm"
          >
            {session?.user ? "Open the app" : "Start free"}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
