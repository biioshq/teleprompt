import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "remote-control";
const doc = docBySlug(SLUG)!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
  alternates: { canonical: `/docs/${SLUG}` },
};

export default function Page() {
  return (
    <DocPage
      slug={SLUG}
      title={doc.title}
      summary={doc.summary}
      toc={[
        { id: "mirror", label: "The mirror" },
        { id: "transport", label: "Transport controls" },
        { id: "gestures", label: "Tap and drag" },
        { id: "pace", label: "Pace" },
        { id: "display", label: "Driving the display" },
        { id: "handover", label: "Handing over" },
      ]}
    >
      <h2 id="mirror">The mirror</h2>
      <p>
        Most of the remote is a copy of the script, moving in step with the
        display. It is not a scaled-down screenshot — it is the same text laid
        out for a phone, at a type size you choose with the two buttons in the
        corner.
      </p>
      <p>
        This works because devices exchange a text anchor rather than a scroll
        offset. Both screens put the same words on their own reading line, and
        neither has to care what shape the other one is.
      </p>

      <h2 id="transport">Transport controls</h2>
      <table>
        <thead>
          <tr>
            <th>Control</th>
            <th>Does</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Play / pause</td>
            <td>Starts and stops the scroll on every device at once.</td>
          </tr>
          <tr>
            <td>Previous line</td>
            <td>
              Steps back one block. From mid-block it goes to the start of the
              current block first, which is what you want when you have lost
              your place.
            </td>
          </tr>
          <tr>
            <td>Next line</td>
            <td>Steps forward one block.</td>
          </tr>
          <tr>
            <td>Half screen</td>
            <td>
              Skips forward half a screen — for a paragraph you decided to cut.
            </td>
          </tr>
          <tr>
            <td>Restart</td>
            <td>Back to the top, paused.</td>
          </tr>
        </tbody>
      </table>
      <p>
        Every control gives a short haptic tick on devices that support it, so
        you can work the remote without looking down.
      </p>

      <h2 id="gestures">Tap and drag</h2>
      <ul>
        <li>
          <strong>Tap a line</strong> to jump the display straight to it. Useful
          when someone asks a question and you need to get back to a specific
          point.
        </li>
        <li>
          <strong>Drag the text</strong> to scrub, like a scroll wheel. The
          display follows continuously while you drag.
        </li>
      </ul>
      <p>
        The two do not fight: a press only counts as a tap if your finger moves
        less than about eight pixels.
      </p>

      <h2 id="pace">Pace</h2>
      <p>
        The minus and plus controls move the pace in steps of ten words per
        minute, between 40 and 320. The full slider is in the display settings
        sheet.
      </p>
      <p>
        Because pace is expressed in words per minute rather than pixels per
        second, changing the type size on the display does not change how fast
        you have to talk.
      </p>

      <Note title="A useful habit">
        Start ten to fifteen wpm slower than you think you need. It is far
        easier to nudge the pace up mid-sentence than to recover from a script
        that has run ahead of you.
      </Note>

      <h2 id="display">Driving the display</h2>
      <p>
        The <strong>Display</strong> button opens a sheet that changes the other
        screen, not this one: type size, line height, column width, where the
        reading line sits, the reading surface, mirroring and the guide.
      </p>
      <p>
        Changes apply to every device in the room immediately. See{" "}
        <Link href="/docs/display-settings">Display settings</Link> for what
        each one does.
      </p>

      <h2 id="handover">Handing over</h2>
      <p>
        Any number of devices can hold a remote. Position is written back to the
        database every few seconds, so a producer can open the remote on their
        own phone mid-session and land exactly where you are.
      </p>
      <p>
        Playback itself is always driven by one device — the display that has
        been connected longest — so there is never a moment where two devices
        disagree about where the script is.
      </p>
    </DocPage>
  );
}
