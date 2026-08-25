import { cn } from "~/lib/utils";

/**
 * A cue, rendered the way the prompter renders one.
 *
 * In a Teleprompt script a line beginning with `::` is a director's note: shown
 * on screen in the accent colour, never read aloud. Reusing that exact form as
 * the site's labelling device means the page is written in the product's own
 * vocabulary instead of the pill-shaped badge every product site ships.
 *
 * Deliberately rare. A label above every section is the templated rhythm this
 * is meant to avoid, so the landing page uses two of these in total.
 */
export function Cue({
  children,
  tone = "paper",
  className,
}: {
  children: React.ReactNode;
  tone?: "paper" | "ink";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-baseline gap-2 font-mono text-[0.6875rem] tracking-[0.1em] uppercase",
        tone === "ink" ? "text-white/70" : "text-muted",
        className,
      )}
    >
      <span aria-hidden className="shrink-0 text-brand select-none">
        ::
      </span>
      <span>{children}</span>
    </p>
  );
}
