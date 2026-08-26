import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "connecting-devices";
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
        { id: "rooms", label: "What a room is" },
        { id: "codes", label: "Join codes" },
        { id: "roles", label: "Roles" },
        { id: "many", label: "More than two devices" },
        { id: "transport", label: "Direct or relay" },
        { id: "lifetime", label: "How long a room lives" },
      ]}
    >
      <h2 id="rooms">What a room is</h2>
      <p>
        A room is one live teleprompter session, owned by one account. It holds
        a snapshot of a script, the current playback state, and the list of
        devices attached to it.
      </p>
      <p>
        Access to a room is not granted by a link. Every device that wants in
        has to be signed in to the account that opened it. The server checks
        ownership on every request, and the secret that names the realtime
        channel (a 256-bit value) is only ever returned to a signed-in device on
        that account.
      </p>

      <Note title="Not a shared link">
        There is deliberately no &ldquo;share this room&rdquo; feature. If a
        third party had the code but not the account, they would still get
        nothing: the code is a lookup key scoped to your account, not a
        credential.
      </Note>

      <h2 id="codes">Join codes</h2>
      <p>
        A code looks like <code>K7M-2QF</code>: six characters in two groups.
        The alphabet leaves out every character that gets misread when someone
        reads it off one screen and types it into another: no <code>O</code> or{" "}
        <code>0</code>, no <code>I</code> or <code>1</code>, no <code>S</code>{" "}
        or <code>5</code>, no <code>B</code> or <code>8</code>.
      </p>
      <p>
        Codes are unique among <em>live</em> rooms only. Once a room ends its
        code goes back into circulation, which is why a code from an earlier
        session will not resolve.
      </p>

      <h2 id="roles">Roles</h2>
      <p>Each device takes one of two roles when it joins.</p>
      <ul>
        <li>
          <strong>Display</strong>: the screen your audience is behind. Full
          bleed, edge fades, a reading line, optional mirroring, and a screen
          wake lock. Chrome fades out a couple of seconds after the text starts
          moving.
        </li>
        <li>
          <strong>Remote</strong>: the device in your hand. Shows the same words
          at its own type size, plus the transport controls.
        </li>
      </ul>
      <p>
        A device can change role by going back to the room page and picking the
        other one; nothing is locked in.
      </p>

      <h2 id="many">More than two devices</h2>
      <p>
        Rooms are not limited to a pair. You can add a second display for a
        co-host reading the same script, or a second remote so a producer can
        take over.
      </p>
      <p>
        Exactly one device drives playback: the display that has been connected
        the longest. Every other device, extra displays included, follows it.
        Both sides work that rule out independently from the presence list, so
        there is no negotiation round trip and no moment where two devices think
        they are in charge.
      </p>
      <p>
        Controls on a following device still work. They are sent to the driver
        as commands, applied there, and broadcast back out.
      </p>

      <h2 id="transport">Direct or relay</h2>
      <p>
        Devices always meet on a realtime channel first, because that works
        everywhere and needs no luck with NAT. As soon as two devices can see
        each other, they exchange WebRTC offers over that channel and try to
        open a direct data channel.
      </p>
      <p>
        If it opens, position updates move onto it and the badge reads{" "}
        <strong>Direct</strong>. If it does not (symmetric NAT, a corporate
        network that blocks UDP, no STUN reachability), the badge reads{" "}
        <strong>Relay</strong> and the same messages keep flowing through the
        relay. There is no degraded mode; the only difference is a few tens of
        milliseconds.
      </p>
      <p>
        Signalling always goes over the relay, even after the direct channel is
        open, because it is what bootstraps the direct path in the first place.
      </p>

      <h2 id="lifetime">How long a room lives</h2>
      <p>
        A room stays live while something is on it. Five quiet minutes after the
        last activity it closes itself, releasing its join code. You can also
        end one deliberately from the room page or from the display&rsquo;s
        settings drawer.
      </p>
      <p>Three things count as activity:</p>
      <ul>
        <li>
          A display or a remote attached to the room. Each checks in every
          forty-five seconds, and again the moment it comes back to the
          foreground.
        </li>
        <li>
          The room page open and <em>visible</em>, which is why walking to the
          other device does not cost you the room. The page you left the code on
          counts while you can see it, and stops counting when you switch away.
        </li>
        <li>
          Saving an edit to the script behind the room, since that writes new
          text into the room itself.
        </li>
      </ul>
      <p>
        What does not count is a device that has gone to sleep. A phone that
        locks or a laptop whose lid is shut stops checking in (browsers freeze a
        hidden tab&rsquo;s timers, and a suspended one sends nothing at all), so
        a room left on one closes like any other.
      </p>
      <p>
        Playback position is written back to the database every few seconds, so
        a device that reloads (or one that drops off the network and comes back)
        picks up within a sentence of where it stopped.
      </p>
      <p>
        Editing the script behind a live room is safe. The new text is written
        into the room as part of the save, and every device picks it up within a
        few seconds, keeping the reading position. You do not have to close the
        room and open another one.
      </p>
      <p>
        See <Link href="/docs/architecture">Architecture</Link> for the message
        formats and the exact state model.
      </p>
    </DocPage>
  );
}
