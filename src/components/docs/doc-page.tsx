import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { docNeighbours } from "~/lib/docs/nav";
import { cn } from "~/lib/utils";

export type TocEntry = { id: string; label: string };

export function DocPage({
  slug,
  title,
  summary,
  toc,
  children,
}: {
  slug: string;
  title: string;
  summary: string;
  toc?: TocEntry[];
  children: React.ReactNode;
}) {
  const { previous, next } = docNeighbours(slug);

  return (
    <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_12rem]">
      <article className="min-w-0">
        <header className="border-b border-line pb-8">
          <h1 className="text-[clamp(2rem,4.5vw,2.75rem)]">{title}</h1>
          <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">
            {summary}
          </p>
        </header>

        <div className="prose-tp mt-10 max-w-2xl">{children}</div>

        <nav className="mt-16 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
          {previous ? (
            <Link
              href={`/docs/${previous.slug}`}
              className="group rounded-sm border border-line p-4 transition-colors hover:border-ink"
            >
              <span className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">
                <ArrowLeft size={11} weight="bold" />
                Previous
              </span>
              <span className="mt-1.5 block text-[0.9375rem] font-medium text-ink">
                {previous.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slug}`}
              className={cn(
                "group rounded-sm border border-line p-4 text-right transition-colors hover:border-ink",
                !previous && "sm:col-start-2",
              )}
            >
              <span className="flex items-center justify-end gap-1.5 font-mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">
                Next
                <ArrowRight size={11} weight="bold" />
              </span>
              <span className="mt-1.5 block text-[0.9375rem] font-medium text-ink">
                {next.title}
              </span>
            </Link>
          ) : null}
        </nav>
      </article>

      {toc && toc.length > 0 ? (
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <h2 className="eyebrow">On this page</h2>
            <ul className="mt-3 space-y-2">
              {toc.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    className="block text-[0.8125rem] leading-snug text-muted transition-colors hover:text-ink"
                  >
                    {entry.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

/** Callout used for the handful of things that genuinely need one. */
export function Note({
  tone = "brand",
  title,
  children,
}: {
  tone?: "brand" | "coral" | "blue";
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    brand: "border-brand bg-brand-soft text-brand-deep",
    coral: "border-coral bg-coral-soft text-coral",
    blue: "border-blue bg-blue-soft text-blue",
  };

  return (
    <div className={cn("not-prose rounded-sm border px-5 py-4", tones[tone])}>
      {title ? (
        <p className="font-mono text-[0.6875rem] tracking-[0.14em] uppercase">
          {title}
        </p>
      ) : null}
      <div className={cn("text-[0.9375rem] leading-relaxed", title && "mt-2")}>
        {children}
      </div>
    </div>
  );
}
