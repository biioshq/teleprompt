import { type Metadata } from "next";

import { DocsNav } from "~/components/docs/docs-nav";

export const metadata: Metadata = {
  title: { default: "Documentation", template: "%s — Teleprompt docs" },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl py-10 gutter lg:py-16">
      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14">
        {/* Mobile disclosure ------------------------------------------------ */}
        <details className="mb-8 rounded-sm border border-line bg-surface lg:hidden [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink">
            Documentation
            <span aria-hidden className="font-mono text-brand">
              ▾
            </span>
          </summary>
          <div className="border-t border-line px-4 py-5">
            <DocsNav />
          </div>
        </details>

        {/* Sidebar ---------------------------------------------------------- */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
            <DocsNav />
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
