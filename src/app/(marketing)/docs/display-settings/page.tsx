import { type Metadata } from "next";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "display-settings";
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
        { id: "shared", label: "Shared, not local" },
        { id: "type", label: "Type size and line height" },
        { id: "column", label: "Column width" },
        { id: "reading", label: "The reading line" },
        { id: "surfaces", label: "Surfaces" },
        { id: "optics", label: "Mirror and flip" },
        { id: "rigs", label: "Setting up a rig" },
      ]}
    >
      <h2 id="shared">Shared, not local</h2>
      <p>
        Everything on this page is a property of the <em>room</em>, not of one
        device. Change the type size from your phone and the display changes;
        change the surface on the display and the phone&rsquo;s settings sheet
        updates to match.
      </p>
      <p>
        That includes type size. The two buttons in the corner of the
        remote&rsquo;s mirror, the <kbd>+</kbd> and <kbd>&minus;</kbd> keys and
        the Type size slider all change the same shared value, so resizing from
        either device moves both.
      </p>
      <p>
        The remote does not render at the display&rsquo;s pixel size, though: a
        phone is not a monitor and should not pretend to be one. It scales the
        shared size down to something readable in the hand, which is possible
        because the two devices agree on a position in the text rather than a
        position in pixels.
      </p>

      <h2 id="type">Type size and line height</h2>
      <p>
        Type runs from 20 to 160 pixels. The right number depends almost
        entirely on distance: as a rule of thumb, you want three to six words
        per line. Fewer and your eyes swing back and forth; more and you lose
        your place on the return.
      </p>
      <p>
        Line height runs from 1.1 to 2.4. Looser lines are easier to track at a
        distance; tighter lines fit more of the next sentence on screen, which
        helps you see what is coming.
      </p>
      <p>
        Neither affects pace. Speed is derived from the measured height of the
        script and its word count, so a change in type size is absorbed
        automatically.
      </p>

      <h2 id="column">Column width</h2>
      <p>
        From 40% to 100% of the screen. On a wide display, pulling the column in
        to 60–70% keeps line lengths readable and keeps your eyes near the
        centre — which, if there is a camera behind the glass, is where you want
        them.
      </p>

      <h2 id="reading">The reading line</h2>
      <p>
        The reading line is the fixed point the text scrolls past, drawn as a
        thin rule with two markers. It can sit anywhere from 15% to 70% down the
        screen.
      </p>
      <ul>
        <li>
          <strong>Around 40%</strong> is the usual choice: comfortably above
          centre, with a couple of lines of lookahead below.
        </li>
        <li>
          <strong>Higher, around 25%</strong>, gives you much more lookahead —
          good for dense material you have not rehearsed.
        </li>
        <li>
          <strong>Lower, around 55%</strong>, puts the text closer to a camera
          mounted below the screen.
        </li>
      </ul>
      <p>
        The guide can be hidden entirely once you have found your position; the
        text still scrolls past the same point.
      </p>

      <h2 id="surfaces">Surfaces</h2>
      <ul>
        <li>
          <strong>Night</strong> — near-black with warm off-white text. The
          default, and the right answer in most rooms.
        </li>
        <li>
          <strong>Amber</strong> — amber text on black. The classic broadcast
          prompter look; the lower blue content is easier on the eyes over a
          long session and throws less colour onto your face in a dark studio.
        </li>
        <li>
          <strong>Paper</strong> — ink on warm off-white. For bright rooms and
          daylight, where a dark screen turns into a mirror.
        </li>
      </ul>

      <h2 id="optics">Mirror and flip</h2>
      <p>
        <strong>Mirror</strong> flips the text horizontally, for a
        beam-splitter: a half-silvered mirror at 45° in front of the lens shows
        you the script while the camera sees straight through. Without the flip,
        the reflection is backwards.
      </p>
      <p>
        <strong>Flip</strong> reverses vertically, for rigs where the display
        sits face-up under the glass.
      </p>

      <Note title="Check before you roll">
        Toggle mirror while looking at the glass, not at the screen. It is the
        reflection that has to be readable, and it is very easy to get this
        backwards in a hurry.
      </Note>

      <h2 id="rigs">Setting up a rig</h2>
      <ol>
        <li>
          Put the display where the reflection lands square in the glass, then
          set the column width so the text sits in the middle of the frame.
        </li>
        <li>
          Set the type size from where you will actually be standing, not from
          arm&rsquo;s length at the desk.
        </li>
        <li>
          Move the reading line until it is as close as possible to the lens.
        </li>
        <li>
          Turn the guide off, and run thirty seconds of the script at your
          intended pace before recording anything.
        </li>
      </ol>
    </DocPage>
  );
}
