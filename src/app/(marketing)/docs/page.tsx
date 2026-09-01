import { type Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GithubLogo } from "@phosphor-icons/react/dist/ssr";

import { ButtonLink } from "~/components/ui/button";
import {
  DEVELOPER_SECTIONS,
  type DocSection,
  USER_SECTIONS,
} from "~/lib/docs/nav";
import { SITE } from "~/lib/site";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "How to write scripts, pair devices, drive a session from your phone, install Teleprompt as an app, and run your own instance.",
  alternates: { canonical: "/docs" },
};

function SectionCards({
  section,
  level = 2,
}: {
  section: DocSection;
  level?: 2 | 3;
}) {
  const SectionHeading = level === 2 ? "h2" : "h3";
  const CardHeading = level === 2 ? "h3" : "h4";

  return (
    <section>
      <SectionHeading className="eyebrow">{section.title}</SectionHeading>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {section.pages.map((page) => (
          <li key={page.slug}>
            <Link
              href={`/docs/${page.slug}`}
              className="group block h-full rounded-sm border border-line bg-surface p-5 transition-colors hover:border-ink"
            >
              <CardHeading className="flex items-center gap-2 text-base font-semibold text-ink">
                {page.title}
                <ArrowRight
                  size={13}
                  weight="bold"
                  className="text-brand opacity-0 transition-opacity group-hover:opacity-100"
                />
              </CardHeading>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
                {page.summary}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DocsIndexPage() {
  return (
    <div>
      <header className="border-b border-line pb-10">
        <p className="eyebrow">Documentation</p>
        <h1 className="mt-4 text-[clamp(2rem,4.5vw,3rem)]">
          Everything Teleprompt does, and why it does it that way.
        </h1>
        <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">
          Start with the quickstart if you just want to read a script off one
          screen and drive it from another. These pages cover using Teleprompt;
          the setup, protocol and contribution pages are further down, for
          people running or changing it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/docs/quickstart" variant="primary">
            Quickstart
            <ArrowRight size={15} weight="bold" />
          </ButtonLink>
          <ButtonLink href={SITE.repo} variant="outline">
            <GithubLogo size={15} weight="bold" />
            Source on GitHub
          </ButtonLink>
        </div>
      </header>

      <div className="mt-12 space-y-12">
        {USER_SECTIONS.map((section) => (
          <SectionCards key={section.title} section={section} />
        ))}
      </div>

      <div className="mt-20 border-t border-line pt-12">
        <h2
          id="for-developers"
          className="scroll-mt-24 text-[clamp(1.5rem,3vw,1.875rem)]"
        >
          For developers
        </h2>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
          These pages are about hosting Teleprompt and changing it rather than
          using it.
        </p>

        <div className="mt-10 space-y-12">
          {DEVELOPER_SECTIONS.map((section) => (
            <SectionCards key={section.title} section={section} level={3} />
          ))}
        </div>
      </div>
    </div>
  );
}
