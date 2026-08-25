"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOC_SECTIONS } from "~/lib/docs/nav";
import { cn } from "~/lib/utils";

export function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

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

      {DOC_SECTIONS.map((section) => (
        <div key={section.title}>
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
      ))}
    </nav>
  );
}
