"use client";

import dynamic from "next/dynamic";

/**
 * The editor is loaded on the client only. It reaches for `window` during
 * module evaluation, and there is nothing useful to render on the server for a
 * control that exists to be typed into.
 */
const Inner = dynamic(() => import("~/components/app/md-editor-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-sm border border-line bg-surface">
      <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-faint uppercase">
        Loading editor
      </span>
    </div>
  ),
});

export function MarkdownEditor(props: {
  value: string;
  onChange: (value: string) => void;
  height: number;
}) {
  return <Inner {...props} />;
}
