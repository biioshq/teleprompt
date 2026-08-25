import { type Metadata } from "next";

import { DocPage, Note } from "~/components/docs/doc-page";
import { KbdCombo } from "~/components/ui/kbd";
import { docBySlug } from "~/lib/docs/nav";
import { groupedShortcuts } from "~/lib/keyboard/shortcuts";

const SLUG = "shortcuts";
const doc = docBySlug(SLUG)!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
  alternates: { canonical: `/docs/${SLUG}` },
};

/**
 * Rendered from the same registry the handlers read, so a key that works is a
 * key that is listed here and vice versa. The prompter has the full set, so it
 * is the one worth tabulating; the only difference on the remote is called out
 * per row.
 */
const SECTIONS = groupedShortcuts("prompter");

export default function Page() {
  return (
    <DocPage
      slug={SLUG}
      title={doc.title}
      summary={doc.summary}
      toc={SECTIONS.map((section) => ({
        id: section.group.toLowerCase().replace(/\s+/g, "-"),
        label: section.group,
      }))}
    >
      <p>
        These work on the display and on the remote. A display that is not the
        one driving playback still responds: the keystroke is sent to the driver
        as a command and applied there.
      </p>
      <p>
        Press <KbdCombo shortcut={{ keys: ["?"] }} /> on either device to see
        this list without leaving the session. Nothing fires while the focus is
        in a text field, and anything held with Ctrl, Cmd or Alt is left to the
        browser.
      </p>

      {SECTIONS.map((section) => (
        <section key={section.group}>
          <h2 id={section.group.toLowerCase().replace(/\s+/g, "-")}>
            {section.group}
          </h2>
          <table>
            <thead>
              <tr>
                <th style={{ width: "42%" }}>Key</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {section.items.map((shortcut) => (
                <tr key={shortcut.action}>
                  <td>
                    <span className="not-prose">
                      <KbdCombo shortcut={shortcut} />
                    </span>
                  </td>
                  <td>
                    {shortcut.label}
                    {shortcut.surfaces.includes("remote") ? null : (
                      <span className="text-faint"> (display only)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <Note title="Presenter clickers">
        Most wireless presenters send Page Up and Page Down, so they drive
        Teleprompt without any setup, on either device. A clicker that sends
        arrow keys works too, stepping block by block instead.
      </Note>
    </DocPage>
  );
}
