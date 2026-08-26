import Link from "next/link";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr";

import { Logo } from "~/components/brand/logo";
import { ButtonLink } from "~/components/ui/button";
import { SITE } from "~/lib/site";
import { auth } from "~/server/auth";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/80 pad-safe-top backdrop-blur-md">
      {/* Three tracks with matching `1fr` edges, so the nav is centred on the
          header itself rather than on whatever the logo and the buttons leave
          over. */}
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-8 gutter">
        <Link href="/" aria-label={SITE.name} className="justify-self-start">
          <Logo
            byline
            wordmarkClassName="text-[1.125rem]"
            markClassName="h-9 w-9"
          />
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

        <div className="flex items-center gap-4 justify-self-end">
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
