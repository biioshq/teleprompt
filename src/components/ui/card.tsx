import { cn } from "~/lib/utils";

export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={cn("rounded-md border border-line bg-surface p-6", className)}
    >
      {children}
    </Tag>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[1.4rem] min-w-[1.4rem] items-center justify-center rounded-xs border border-line bg-paper px-1.5 font-mono text-[0.6875rem] font-medium text-ink">
      {children}
    </kbd>
  );
}
