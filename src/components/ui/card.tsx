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
