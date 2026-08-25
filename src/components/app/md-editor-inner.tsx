"use client";

import MDEditor, {
  commands,
  type ICommand,
} from "@uiw/react-md-editor/nohighlight";

import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

/**
 * A cue is Teleprompt's one addition to Markdown: a line starting with `::` is
 * a note to the reader — "look at camera", "wait for the slide" — shown on the
 * prompter in orange and excluded from the word count, because nobody says it
 * out loud.
 */
const cueCommand: ICommand = {
  name: "cue",
  keyCommand: "cue",
  buttonProps: {
    "aria-label": "Insert a cue",
    title: "Cue — shown on the prompter, never read aloud",
  },
  icon: (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.05em",
      }}
    >
      ::
    </span>
  ),
  execute: (state, api) => {
    const text = state.selectedText?.trim() ?? "";
    api.replaceSelection(`\n:: ${text || "look at camera"}\n`);
  },
};

const TOOLBAR: ICommand[] = [
  commands.title2,
  commands.title3,
  commands.divider,
  commands.bold,
  commands.italic,
  commands.divider,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.quote,
  commands.hr,
  commands.divider,
  cueCommand,
];

export default function MarkdownEditorInner({
  value,
  onChange,
  height,
}: {
  value: string;
  onChange: (value: string) => void;
  height: number;
}) {
  return (
    <div className="tp-editor" data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(next) => onChange(next ?? "")}
        height={height}
        preview="edit"
        visibleDragbar={false}
        commands={TOOLBAR}
        extraCommands={[
          commands.codeEdit,
          commands.codeLive,
          commands.codePreview,
        ]}
        textareaProps={{
          placeholder:
            "Write the words you are going to say.\n\nA heading starts a section. A bullet is one beat. A line that starts with :: is a cue only you see.",
          spellCheck: true,
        }}
      />
    </div>
  );
}
