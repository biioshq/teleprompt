"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  type DocSection,
  DEVELOPER_SECTIONS,
  USER_SECTIONS,
} from "~/lib/docs/nav";
import { cn } from "~/lib/utils";

export function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const renderSection = (section: DocSection) => (
    <NavSection
      key={section.title}
      section={section}
      pathname={pathname}
      onNavigate={onNavigate}
    />
  );

  return (
    <nav aria-label="Documentation" className="space-y-7">
      <Link
        href="/docs"
        onClick={onNavigate}
        className={cn(
          "block text-[0.875rem] transition-colors",
          pathname === "/docs"
            ? "font-medium text-ink"
            : "text-muted hover:text-ink",
        )}
      >
        Overview
      </Link>

      {USER_SECTIONS.map(renderSection)}

      {/* The developer tier sits below a rule so the presenter-facing pages
          above it read as the whole of the documentation until you go looking. */}
      <section
        aria-labelledby="docs-nav-developers"
        className="border-t border-line pt-7"
      >
        <p
          id="docs-nav-developers"
          className="text-[0.9375rem] font-medium text-ink"
        >
          For developers
        </p>
        <p className="mt-1 text-[0.8125rem] leading-snug text-muted">
          Running or changing Teleprompt, rather than using it.
        </p>

        <div className="mt-6 space-y-7">
          {DEVELOPER_SECTIONS.map(renderSection)}
        </div>
      </section>
    </nav>
  );
}

function NavSection({
  section,
  pathname,
  onNavigate,
}: {
  section: DocSection;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <h2 className="eyebrow">{section.title}</h2>
      <ul className="mt-3 space-y-0.5 border-l border-line">
        {section.pages.map((page) => {
          const href = `/docs/${page.slug}`;
          const active = pathname === href;
          return (
            <li key={page.slug}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-ml-px block border-l py-1.5 pl-4 text-[0.875rem] transition-colors",
                  active
                    ? "border-brand font-medium text-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {page.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
