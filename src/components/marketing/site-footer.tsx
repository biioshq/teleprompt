import Link from "next/link";
import {
  ArrowUpRight,
  GithubLogo,
  InstagramLogo,
  LinkedinLogo,
} from "@phosphor-icons/react/dist/ssr";

import { BiiosWordmark, Logo } from "~/components/brand/logo";
import { BIIOS, SITE } from "~/lib/site";

const PRODUCT = [
  { href: "/app", label: "Scripts" },
  { href: "/join", label: "Join a room" },
  { href: "/#how", label: "How it works" },
  { href: "/#voice", label: "Voice tracking" },
  { href: "/#sync", label: "The sync protocol" },
];

const DOCS = [
  { href: "/docs/quickstart", label: "Quickstart" },
  { href: "/docs/writing-scripts", label: "Writing scripts" },
  { href: "/docs/remote-control", label: "Remote control" },
  { href: "/docs/install", label: "Install as an app" },
  { href: "/docs/self-hosting", label: "Self-hosting" },
];

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/open-source", label: "Licence" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-deep">
      <div className="mx-auto max-w-6xl py-14 gutter">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[0.875rem] leading-relaxed text-muted">
              A peer-to-peer teleprompter. One device shows the words, another
              drives them.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href={SITE.repo}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="GitHub"
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-line text-muted transition-colors hover:border-ink hover:text-ink"
              >
                <GithubLogo size={15} weight="bold" />
              </a>
              <a
                href={BIIOS.linkedin}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Biios on LinkedIn"
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-line text-muted transition-colors hover:border-ink hover:text-ink"
              >
                <LinkedinLogo size={15} weight="bold" />
              </a>
              <a
                href={BIIOS.instagram}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Biios on Instagram"
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-line text-muted transition-colors hover:border-ink hover:text-ink"
              >
                <InstagramLogo size={15} weight="bold" />
              </a>
            </div>
          </div>

          <nav aria-label="Product">
            <h2 className="eyebrow">Product</h2>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[0.875rem] text-muted transition-colors hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Documentation">
            <h2 className="eyebrow">Docs</h2>
            <ul className="mt-4 space-y-2.5">
              {DOCS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[0.875rem] text-muted transition-colors hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow">The studio</h2>
            <a
              href={BIIOS.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group mt-4 inline-flex items-center gap-1.5"
            >
              <BiiosWordmark className="text-lg text-ink" />
              <ArrowUpRight
                size={14}
                weight="bold"
                className="text-brand transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
            <p className="mt-3 text-[0.875rem] leading-relaxed text-muted">
              {BIIOS.tagline} A startup consulting studio in {BIIOS.city},
              working across strategy, branding, digital and growth.
            </p>
            <a
              href={BIIOS.contact}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-block text-[0.875rem] text-ink underline decoration-brand decoration-2 underline-offset-4"
            >
              Work with Biios
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6">
          <p className="font-mono text-[0.6875rem] tracking-[0.1em] text-muted">
            Built with {"<3"} by {BIIOS.name} for the Community.
          </p>
          <p className="font-mono text-[0.6875rem] tracking-[0.1em] text-faint">
            {SITE.license} licensed
          </p>
          <nav className="ml-auto flex items-center gap-5">
            {LEGAL.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[0.75rem] text-faint transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
