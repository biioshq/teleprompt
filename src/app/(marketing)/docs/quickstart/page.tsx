import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "quickstart";
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
        { id: "before", label: "Before you start" },
        { id: "write", label: "1. Write something" },
        { id: "open", label: "2. Open a room" },
        { id: "pair", label: "3. Pair the second device" },
        { id: "read", label: "4. Read" },
        { id: "next", label: "Where to go next" },
      ]}
    >
      <h2 id="before">Before you start</h2>
      <p>
        You need two things: a Google or GitHub account, and two devices you can
        sign into with it. That is the entire pairing model: a room is the set
        of devices signed in as you, so there is no invite to send and no link
        to leak.
      </p>
      <p>
        The two devices do <strong>not</strong> have to be on the same network.
        Same Wi-Fi gives the lowest latency and the best chance of a direct
        peer-to-peer route, but a phone on mobile data and a laptop on venue
        Wi-Fi will pair perfectly well.
      </p>

      <h2 id="write">1. Write something</h2>
      <p>
        Sign in and press <strong>New script</strong>. If it is your first one,
        Teleprompt seeds a short sample that walks through this same process
        while you read it.
      </p>
      <p>The editor is Markdown. Four pieces of syntax do most of the work:</p>
      <ul>
        <li>
          <code>## Section</code> splits the script into parts.
        </li>
        <li>
          <code>- bullet</code> gives you one beat per line, which is what a
          remote steps through.
        </li>
        <li>
          <code>:: cue</code> is a note to yourself, shown in orange on the
          prompter, never counted as a spoken word.
        </li>
        <li>
          <code>---</code> draws a hard break.
        </li>
      </ul>
      <p>
        Saving is automatic. The sidebar counts your words and tells you how
        long the script runs at 130 words per minute, which is a comfortable
        spoken pace rather than a silent-reading one.
      </p>

      <h2 id="open">2. Open a room</h2>
      <p>
        Press <strong>Start a session</strong>. Teleprompt takes a snapshot of
        the script, opens a room and gives you a six-character join code such as{" "}
        <code>K7M-2QF</code>.
      </p>
      <p>
        On the room page, choose <strong>Use this device as the display</strong>
        . That screen goes full width, holds a screen wake lock so it will not
        dim, and starts listening for a remote.
      </p>

      <Note title="Why a snapshot">
        A room holds a copy of the script rather than a live reference, because
        both devices have to render byte-identical text for their block indices
        to line up. Keeping that copy current is the app&rsquo;s job: edit the
        script and every device in the room picks the change up within a few
        seconds, carrying your reading position across rather than resetting it.
      </Note>

      <h2 id="pair">3. Pair the second device</h2>
      <p>
        On your phone, open Teleprompt and sign in to the same account. Either
        provider works, as long as the verified email address matches. Go to{" "}
        <strong>Join a room</strong>, type the code, and choose{" "}
        <strong>Be the remote</strong>.
      </p>
      <p>
        The two devices find each other within a second or so. The badge in the
        header tells you which path they found:
      </p>
      <ul>
        <li>
          <strong>Direct</strong>: a WebRTC data channel straight between the
          devices. Nothing sits in between.
        </li>
        <li>
          <strong>Relay</strong>: no direct route was possible, so messages go
          through the realtime relay. Everything still works.
        </li>
      </ul>

      <h2 id="read">4. Read</h2>
      <p>
        Press play on the phone. The display starts scrolling, and the phone
        shows you the same words moving at the same rate, laid out for a phone,
        not shrunk down from the display.
      </p>
      <p>While you are reading, the remote can:</p>
      <ul>
        <li>Change the pace, in words per minute, without stopping.</li>
        <li>Step to the previous or next block.</li>
        <li>Tap any visible line to jump the display straight to it.</li>
        <li>Drag the text to scrub, exactly like a scroll wheel.</li>
        <li>
          Change type size, mirroring and the reading surface on the display,
          from your hand.
        </li>
      </ul>

      <h2 id="next">Where to go next</h2>
      <ul>
        <li>
          <Link href="/docs/writing-scripts">Writing scripts</Link>: everything
          the editor understands.
        </li>
        <li>
          <Link href="/docs/remote-control">The remote</Link>: every control on
          the phone.
        </li>
        <li>
          <Link href="/docs/install">Install as an app</Link>: put it on the
          home screen so it opens full screen.
        </li>
        <li>
          <Link href="/docs/display-settings">Display settings</Link>: type
          size, mirroring and the reading line.
        </li>
      </ul>
    </DocPage>
  );
}
