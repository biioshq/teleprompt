import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "architecture";
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
        { id: "problem", label: "The problem with scroll offsets" },
        { id: "anchors", label: "Anchors" },
        { id: "state", label: "The room state" },
        { id: "transports", label: "Two transports" },
        { id: "protocol", label: "The wire protocol" },
        { id: "authority", label: "Who drives" },
        { id: "reckoning", label: "Dead reckoning" },
        { id: "durability", label: "Durability" },
        { id: "security", label: "Access control" },
        { id: "map", label: "Where the code lives" },
      ]}
    >
      <h2 id="problem">The problem with scroll offsets</h2>
      <p>
        The obvious way to sync two prompters is to send a scroll position.
        Device A is at 2,140 pixels; tell device B to go to 2,140 pixels.
      </p>
      <p>
        That works only while both devices are the same shape. In practice they
        never are: one is a laptop in landscape at 72px type, the other is a
        phone in portrait at 19px. The same pixel offset is a completely
        different sentence on each — and the whole promise of the product is
        that the two screens show the same words.
      </p>
      <p>
        Normalising helps less than it looks. A fraction of total scroll height
        is still a fraction of a different layout, and the error grows with the
        length of the script.
      </p>

      <h2 id="anchors">Anchors</h2>
      <p>
        Teleprompt syncs a position in the <em>text</em> instead. A script is
        split into an ordered list of blocks by a pure function of the source
        string, so every device produces exactly the same list. A position is
        then two numbers:
      </p>
      <pre>
        <code>{`type Anchor = {
  blockIndex: number;     // which block is on the reading line
  blockFraction: number;  // 0 = its first line, 1 = its last
};`}</code>
      </pre>
      <p>Each device resolves that against its own layout:</p>
      <pre>
        <code>{`// anchor -> pixels, on this device
position = block.offsetTop + anchor.blockFraction * block.height;

// pixels -> anchor, on this device
blockIndex    = binarySearchForBlockContaining(position);
blockFraction = (position - block.offsetTop) / block.height;`}</code>
      </pre>
      <p>
        Because the block list is identical everywhere and the geometry is
        local, a phone and a monitor land on the same sentence without either
        one knowing anything about the other&rsquo;s screen.
      </p>

      <Note title="Why the script is snapshotted">
        Identical block lists depend on identical source text. That is why a
        room holds a copy of the script rather than a live reference, and why
        pulling in edits is an explicit action that resets the position.
      </Note>

      <h2 id="state">The room state</h2>
      <p>
        One object describes everything about a live session. It is what gets
        broadcast, and what gets persisted:
      </p>
      <pre>
        <code>{`type PrompterState = {
  anchor: Anchor;
  isPlaying: boolean;
  speedWpm: number;       // 40-320, words per minute
  fontSize: number;       // 20-160 px
  lineHeight: number;     // 1.1-2.4
  contentWidth: number;   // 40-100 %
  readingLine: number;    // 0.15-0.7 of viewport height
  flipHorizontal: boolean;
  flipVertical: boolean;
  showReadingLine: boolean;
  theme: "night" | "amber" | "paper";
  revision: number;       // monotonic; higher wins
  updatedAt: number;      // epoch ms, stamped by the writer
};`}</code>
      </pre>
      <p>
        Speed is stored in words per minute and converted to pixels per second
        at render time, using the measured height of the script and its spoken
        word count:
      </p>
      <pre>
        <code>{`pixelsPerSecond = (speedWpm / 60) * (scrollableHeight / spokenWords)`}</code>
      </pre>
      <p>
        So the same pace setting means the same delivery speed on every device,
        and changing the type size mid-take does not change how fast you have to
        talk.
      </p>

      <h2 id="transports">Two transports</h2>
      <p>
        Devices always meet on a Supabase Realtime channel named by the
        room&rsquo;s secret key. That works from anywhere and needs no luck with
        NAT traversal, and it carries presence, so each device knows who else is
        in the room and what role they took.
      </p>
      <p>
        As soon as two devices see each other, they exchange WebRTC offers over
        that channel and try to open a data channel directly between them. Which
        side offers is decided by comparing the two device keys, so both sides
        reach the same answer with no extra round trip.
      </p>
      <p>
        Sending prefers the direct channel and falls back per peer: every peer
        with an open data channel gets the message directly, and if any peer is
        missing, the message also goes out over the relay. Receivers deduplicate
        on <code>(from, seq)</code>, so arriving twice is harmless.
      </p>
      <p>
        Signalling itself always goes over the relay. It is what bootstraps the
        direct path, so it cannot depend on it.
      </p>

      <h2 id="protocol">The wire protocol</h2>
      <p>
        Every message is a small JSON object, validated with the same Zod schema
        on both ends. Nothing that arrives off the network is trusted.
      </p>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Direction</th>
            <th>Carries</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>hello</code>
            </td>
            <td>Any device, on join</td>
            <td>Device key, label, role. The driver answers with state.</td>
          </tr>
          <tr>
            <td>
              <code>state</code>
            </td>
            <td>Driver to everyone</td>
            <td>
              The full <code>PrompterState</code>, about ten times a second
              while scrolling.
            </td>
          </tr>
          <tr>
            <td>
              <code>cmd</code>
            </td>
            <td>Follower to driver</td>
            <td>
              <code>play</code>, <code>pause</code>, <code>toggle</code>,{" "}
              <code>seek</code>, <code>step</code>, <code>scrub</code>,{" "}
              <code>speed</code>, <code>settings</code>, <code>restart</code>,{" "}
              <code>requestState</code>, <code>end</code>.
            </td>
          </tr>
          <tr>
            <td>
              <code>reload</code>
            </td>
            <td>Any device</td>
            <td>The room&rsquo;s script snapshot changed; refetch it.</td>
          </tr>
          <tr>
            <td>
              <code>ping</code> / <code>pong</code>
            </td>
            <td>Any device</td>
            <td>
              Round-trip latency, which is the number in the connection badge.
            </td>
          </tr>
          <tr>
            <td>
              <code>signal</code>
            </td>
            <td>Device to one device</td>
            <td>WebRTC offer, answer or ICE candidate.</td>
          </tr>
        </tbody>
      </table>

      <h2 id="authority">Who drives</h2>
      <p>
        Exactly one device integrates time into position: the display that has
        been connected longest, decided by comparing presence timestamps and
        falling back to the device key on a tie. Every device evaluates that
        rule against the same presence list, so they all reach the same answer
        independently.
      </p>
      <p>
        Every other device is a follower. Followers do not simulate playback
        from their own clock; they send commands and render what they are told.
        This is what keeps two displays from drifting apart over a long read.
      </p>

      <h2 id="reckoning">Dead reckoning</h2>
      <p>
        Position updates arrive about ten times a second. Rendering them
        directly would look like a slideshow, so followers extrapolate:
      </p>
      <pre>
        <code>{`elapsed   = (now - snapshot.receivedAt) / 1000;
predicted = anchorToPosition(snapshot.anchor)
          + (snapshot.isPlaying ? pixelsPerSecond * elapsed : 0);

// ease toward the prediction every frame, or snap if we are far out
position += (predicted - position) * 0.18;`}</code>
      </pre>
      <p>
        The result is smooth 60fps motion driven by 10Hz data, with drift
        corrected continuously rather than in visible jumps. A gap larger than
        about two and a half screens is treated as a seek and snapped.
      </p>
      <p>
        None of this goes through React. The engine writes{" "}
        <code>transform: translate3d(...)</code> straight to the DOM from a
        requestAnimationFrame loop, and the block list is memoised on the source
        text, so a twenty-minute take can run without a single re-render.
      </p>

      <h2 id="durability">Durability</h2>
      <p>
        The driving device writes the state back through tRPC every six seconds
        and once more when it disconnects. Writes carry the state&rsquo;s
        revision number and the server rejects anything older than what it
        already has, so two devices flushing at once cannot move the room
        backwards.
      </p>
      <p>
        That is the only reason the database is in the loop at all. The realtime
        path is the fast path; persistence exists so a reload lands within a
        sentence of where you were.
      </p>

      <h2 id="security">Access control</h2>
      <ul>
        <li>
          Every tRPC procedure that touches a room checks that the room belongs
          to the signed-in user. There is no unauthenticated path to a room.
        </li>
        <li>
          The realtime channel is named by a 256-bit random key stored on the
          room. It is returned by exactly one endpoint, and only to a signed-in
          device on the owning account.
        </li>
        <li>
          The join code is a lookup key scoped to your account, not a
          credential. Someone with the code and no account gets nothing.
        </li>
        <li>
          The browser holds only the Supabase publishable key, and never reads
          or writes a table with it. All data access goes through tRPC on the
          server.
        </li>
        <li>
          Every inbound message is schema-validated before it is acted on.
        </li>
      </ul>

      <h2 id="map">Where the code lives</h2>
      <table>
        <thead>
          <tr>
            <th>Path</th>
            <th>What is in it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>src/lib/markdown/blocks.ts</code>
            </td>
            <td>The deterministic splitter. Pure, no environment input.</td>
          </tr>
          <tr>
            <td>
              <code>src/lib/prompter/state.ts</code>
            </td>
            <td>State shape, limits, themes, anchor type.</td>
          </tr>
          <tr>
            <td>
              <code>src/lib/realtime/protocol.ts</code>
            </td>
            <td>Message schemas and the offer/answer tie-break.</td>
          </tr>
          <tr>
            <td>
              <code>src/lib/realtime/link.ts</code>
            </td>
            <td>Channel, presence, deduplication, per-peer send.</td>
          </tr>
          <tr>
            <td>
              <code>src/lib/realtime/peer.ts</code>
            </td>
            <td>The WebRTC mesh and its failure handling.</td>
          </tr>
          <tr>
            <td>
              <code>src/components/prompter/engine.ts</code>
            </td>
            <td>
              Measurement, the frame loop, anchor conversion, dead reckoning.
            </td>
          </tr>
          <tr>
            <td>
              <code>src/server/api/routers/room.ts</code>
            </td>
            <td>Room lifecycle, ownership checks, state persistence.</td>
          </tr>
        </tbody>
      </table>
      <p>
        If you want to change how any of this behaves, start with{" "}
        <Link href="/docs/contributing">Contributing</Link>.
      </p>
    </DocPage>
  );
}
