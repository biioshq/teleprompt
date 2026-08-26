import { type Metadata } from "next";
import Link from "next/link";

import { DocPage } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "troubleshooting";
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
        { id: "code", label: "The code will not resolve" },
        { id: "relay", label: "It says Relay, not Direct" },
        { id: "catching-up", label: "The badge says Catching up" },
        { id: "lag", label: "The two screens lag apart" },
        { id: "dim", label: "The display dims or sleeps" },
        { id: "mirror", label: "Mirrored text looks wrong" },
        { id: "ios", label: "iOS oddities" },
        { id: "stuck", label: "A device is stuck connecting" },
        { id: "signin", label: "Sign-in problems" },
      ]}
    >
      <h2 id="code">The code will not resolve</h2>
      <p>Three causes, in order of likelihood:</p>
      <ul>
        <li>
          <strong>The room ended.</strong> Rooms close after five quiet minutes
          (nothing attached to them, and the room page neither open nor in front
          of you) and release their code. Open a new session from the script.
          Leaving the room page up and visible while you fetch the other device
          is what keeps this from happening.
        </li>
        <li>
          <strong>Different accounts.</strong> The second device is signed in as
          someone else. A personal account on the phone and a work account on
          the laptop is the classic version. Rooms are scoped to an account, so
          the lookup genuinely finds nothing. Check the avatar in the header on
          both.
        </li>
        <li>
          <strong>A mistyped character.</strong> The alphabet excludes lookalike
          characters, but it is still worth reading it back.
        </li>
      </ul>

      <h2 id="relay">It says Relay, not Direct</h2>
      <p>
        No direct route could be negotiated, so messages go through the realtime
        relay. Everything works; it is a matter of tens of milliseconds. Common
        causes:
      </p>
      <ul>
        <li>Corporate or campus networks that block UDP or STUN.</li>
        <li>Symmetric NAT on one side, which STUN alone cannot get through.</li>
      </ul>
      <p>
        The upgrade is retried in the background for about a minute, then left
        alone. That is deliberate: the relay carries a session perfectly well,
        and a pair that cannot reach each other will not start being able to.
      </p>
      <p>
        <strong>Same Wi-Fi and still on the relay?</strong> Two causes account
        for most of it, and neither is something the app can work around:
      </p>
      <ul>
        <li>
          <strong>Client isolation.</strong> Guest and venue networks very often
          block traffic between devices on the same access point, on purpose.
          Everything reaches the internet; nothing reaches the laptop two feet
          away. A phone hotspot is the quickest way to confirm it: if the badge
          flips to Direct there, the network was isolating clients.
        </li>
        <li>
          <strong>A VPN on either device.</strong> It changes the route out and
          usually hides the local addresses that would otherwise let the two
          devices find each other on the LAN.
        </li>
      </ul>
      <p>
        Beyond that, direct routes on genuinely hostile networks need a TURN
        server, which the hosted instance does not run. Expect the relay there,
        and plan around the few extra milliseconds rather than the badge.
      </p>

      <h2 id="catching-up">The badge says &ldquo;Catching up&rdquo;</h2>
      <p>
        The realtime channel is not carrying traffic, so this device is reading
        the room&rsquo;s saved position over HTTPS instead of receiving it from
        the other device. The session still works; it is a couple of seconds
        behind, and it corrects itself as soon as the channel recovers.
      </p>
      <p>
        It usually means a network that blocks WebSockets, or a socket that died
        while the device was asleep. Bringing the app back to the foreground
        forces a reconnect, as does moving to a different network.
      </p>

      <h2 id="lag">The two screens lag apart</h2>
      <p>
        A small, constant offset is normal and is just the network delay; the
        follower extrapolates to hide it. If they are visibly out of step:
      </p>
      <ul>
        <li>
          Check the latency figure in the badge. Anything over about 400ms will
          be noticeable.
        </li>
        <li>
          If one device was in the background, bring it forward. Browsers
          throttle timers in background tabs, and the follower catches up within
          a second of returning.
        </li>
        <li>
          If they are on genuinely different text (one shows an old version),
          the room snapshot and the script have diverged. Open the room page and
          pull the edits in.
        </li>
      </ul>

      <h2 id="dim">The display dims or sleeps</h2>
      <p>
        The display asks for a screen wake lock, which most modern browsers
        honour. It is dropped whenever the tab is hidden and re-requested when
        it comes back. If your screen still sleeps:
      </p>
      <ul>
        <li>
          The wake lock needs a secure context. Over plain HTTP on a LAN address
          it will not be granted.
        </li>
        <li>Low-power mode on iOS can override it.</li>
        <li>
          Installing Teleprompt to the home screen and running it full screen is
          the most reliable configuration.
        </li>
      </ul>

      <h2 id="mirror">Mirrored text looks wrong</h2>
      <p>
        Mirror is for a beam-splitter, where you read the <em>reflection</em>.
        Looking at the screen directly, mirrored text is supposed to look
        backwards. Judge it in the glass.
      </p>
      <p>
        If the reflection is upside down rather than backwards, you want{" "}
        <strong>Flip</strong> as well; that is the face-up-under-glass
        configuration.
      </p>

      <h2 id="ios">iOS oddities</h2>
      <ul>
        <li>
          <strong>Add to Home Screen is Safari-only.</strong> Chrome and Firefox
          on iOS cannot install a web app.
        </li>
        <li>
          <strong>An installed app has its own session.</strong> You will sign
          in once inside the installed app even if you were signed in in Safari.
        </li>
        <li>
          <strong>Haptics on the remote need a real tap.</strong> The vibration
          API is unavailable in Safari, so the remote is silent there; the
          controls still work.
        </li>
      </ul>

      <h2 id="stuck">A device is stuck connecting</h2>
      <p>
        Press <strong>Retry</strong> next to the connection badge. It appears
        once a join has actually failed, and forces a fresh one immediately
        rather than waiting out the backoff.
      </p>
      <p>
        Behind that, three things happen on their own: a join that never answers
        is abandoned after twelve seconds and retried; repeated failures drop
        the shared socket entirely and build a new one, on the assumption that
        the channel is not the problem; and the session keeps working off the
        saved position in the meantime, which is what the badge means by{" "}
        <em>Catching up</em>.
      </p>
      <p>
        The badge shows <em>Connecting</em> or <em>Reconnecting</em> for more
        than a few seconds:
      </p>
      <ol>
        <li>Reload the page. Rejoining is cheap and re-announces presence.</li>
        <li>
          Confirm the other device is actually on the room page, not the lobby.
        </li>
      </ol>

      <h2 id="signin">Sign-in problems</h2>
      <p>
        <strong>
          &ldquo;That account has no verified email address&rdquo;
        </strong>{" "}
        means the provider handed back an address it has not verified.
        Teleprompt recognises your other devices by email, so it refuses those
        rather than risk putting you in somebody else&rsquo;s account. Verify
        the address with the provider and try again.
      </p>
      <p>
        <strong>Signed in with the other button and got a new account?</strong>{" "}
        That should not happen: accounts sharing a verified email are linked, so
        Google on the laptop and GitHub on the phone land in the same place. If
        the two providers hold <em>different</em> email addresses, they are two
        different people as far as Teleprompt is concerned, and the join code
        will not resolve.
      </p>

      <hr className="mt-14" />
      <p className="text-muted">
        Problems with an instance you host yourself (the health check, the
        database endpoint, sign-in that only fails in production) are on{" "}
        <Link href="/docs/deployment-troubleshooting">
          Deployment troubleshooting
        </Link>
        .
      </p>
    </DocPage>
  );
}
