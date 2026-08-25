import { type Metadata } from "next";

import { DocPage, Note } from "~/components/docs/doc-page";
import { Kbd } from "~/components/ui/card";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "shortcuts";
const doc = docBySlug(SLUG)!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
  alternates: { canonical: `/docs/${SLUG}` },
};

const GROUPS = [
  {
    title: "Playback",
    rows: [
      { keys: ["Space"], action: "Play or pause" },
      { keys: ["↓"], alt: ["J"], action: "Next block" },
      { keys: ["↑"], alt: ["K"], action: "Previous block" },
      { keys: ["Page Down"], action: "Forward most of a screen" },
      { keys: ["Page Up"], action: "Back most of a screen" },
      { keys: ["Home"], alt: ["R"], action: "Back to the top, paused" },
    ],
  },
  {
    title: "Pace and type",
    rows: [
      { keys: ["→"], action: "Ten words per minute faster" },
      { keys: ["←"], action: "Ten words per minute slower" },
      { keys: ["+"], action: "Larger type" },
      { keys: ["−"], action: "Smaller type" },
    ],
  },
  {
    title: "The screen",
    rows: [
      { keys: ["F"], action: "Fullscreen" },
      { keys: ["M"], action: "Mirror horizontally" },
      { keys: ["S"], action: "Open or close settings" },
      { keys: ["Esc"], action: "Close settings" },
    ],
  },
];

export default function Page() {
  return (
    <DocPage
      slug={SLUG}
      title={doc.title}
      summary={doc.summary}
      toc={GROUPS.map((group) => ({
        id: group.title.toLowerCase().replace(/\s+/g, "-"),
        label: group.title,
      }))}
    >
      <p>
        These work on the display. They also work on a display that is not the
        one driving playback — the keystroke is sent to the driver as a command
        and applied there.
      </p>
      <p>
        Nothing fires while the focus is in a text field, so typing in the
        editor is never intercepted.
      </p>

      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 id={group.title.toLowerCase().replace(/\s+/g, "-")}>
            {group.title}
          </h2>
          <table>
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Key</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.action}>
                  <td>
                    <span className="not-prose inline-flex items-center gap-1.5">
                      {row.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                      {row.alt ? (
                        <>
                          <span className="text-[0.75rem] text-faint">or</span>
                          {row.alt.map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </>
                      ) : null}
                    </span>
                  </td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <Note title="Presenter clickers">
        Most wireless presenters send Page Up and Page Down, so they drive
        Teleprompt without any setup. A clicker that sends arrow keys works too
        — it will step block by block instead.
      </Note>
    </DocPage>
  );
}
