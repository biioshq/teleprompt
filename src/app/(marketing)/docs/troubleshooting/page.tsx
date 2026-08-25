import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
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
        { id: "lag", label: "The two screens lag apart" },
        { id: "dim", label: "The display dims or sleeps" },
        { id: "mirror", label: "Mirrored text looks wrong" },
        { id: "ios", label: "iOS oddities" },
        { id: "stuck", label: "A device is stuck connecting" },
        { id: "signin", label: "Sign-in fails" },
        { id: "prod-only", label: "Works locally, fails deployed" },
      ]}
    >
      <h2 id="code">The code will not resolve</h2>
      <p>Three causes, in order of likelihood:</p>
      <ul>
        <li>
          <strong>Different accounts.</strong> The second device is signed in as
          someone else. A personal account on the phone and a work account on
          the laptop is the classic version. Rooms are scoped to an account, so
          the lookup genuinely finds nothing. Check the avatar in the header on
          both.
        </li>
        <li>
          <strong>The room ended.</strong> Rooms close after twelve quiet hours
          and release their code. Open a new session from the script.
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
        <li>
          A VPN on one device, which usually prevents a direct route being
          found.
        </li>
      </ul>
      <p>
        Putting both devices on the same Wi-Fi almost always produces a direct
        connection. If you need direct routes on hostile networks, that requires
        a TURN server, which the hosted instance does not run — it is on the
        list of <Link href="/docs/contributing">things worth contributing</Link>
        .
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
          If they are on genuinely different text — one shows an old version —
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
        <strong>Flip</strong> as well — that is the face-up-under-glass
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
        The badge shows <em>Connecting</em> or <em>Reconnecting</em> for more
        than a few seconds:
      </p>
      <ol>
        <li>Reload the page. Rejoining is cheap and re-announces presence.</li>
        <li>
          Confirm the other device is actually on the room page, not the lobby.
        </li>
        <li>
          If you are self-hosting, check that{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set in the{" "}
          <em>build</em> environment — they are inlined at build time, so
          setting them only at runtime leaves the client with nothing to connect
          to.
        </li>
      </ol>

      <h2 id="signin">Sign-in fails</h2>
      <Note tone="coral" title="UntrustedHost">
        Set <code>AUTH_TRUST_HOST=&quot;true&quot;</code>. Auth.js will not
        derive callback URLs from the Host header without it, and every host
        except Vercel needs it set explicitly.
      </Note>
      <p>
        <strong>redirect_uri_mismatch</strong> means the exact callback URL is
        not registered with the provider. It must match character for character,
        including the scheme and any port:{" "}
        <code>https://your-domain.example/api/auth/callback/google</code>, or{" "}
        <code>.../callback/github</code>. Remember that a GitHub OAuth App holds
        only one callback URL, so development and production need separate apps.
      </p>
      <h2 id="prod-only">Works locally, fails deployed</h2>
      <p>
        The specific shape of this one:{" "}
        <em>&ldquo;This deployment&rsquo;s sign-in is misconfigured&rdquo;</em>{" "}
        in production, with the identical environment variables that work on
        your machine.
      </p>
      <p>
        The usual cause is not the auth configuration at all. It is{" "}
        <code>DATABASE_URL</code> pointing at Supabase&rsquo;s direct{" "}
        <code>db.&lt;ref&gt;.supabase.co</code> endpoint, which resolves to an
        IPv6 address <strong>only</strong>. Your laptop has IPv6, so it
        connects. Vercel&rsquo;s functions do not, so they cannot. Auth.js
        reaches for the adapter, the adapter cannot reach Postgres, and what
        arrives in the browser is a generic configuration error that never
        mentions a database.
      </p>
      <p>Confirm it in a terminal:</p>
      <pre>
        <code>{`# no output means no IPv4 address, and no route from Vercel
dig +short A db.YOUR_REF.supabase.co`}</code>
      </pre>
      <p>
        The fix is a pooler URI, from{" "}
        <strong>Project Settings &rarr; Database</strong>. Note that the
        username changes to <code>postgres.&lt;project-ref&gt;</code>:
      </p>
      <pre>
        <code>{`DATABASE_URL="postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"`}</code>
      </pre>
      <p>
        Redeploy afterwards. <code>DATABASE_URL</code> is read at run time, but
        a running deployment will not pick up a changed variable on its own.
      </p>
      <p>
        If the database is reachable and the error persists, check that{" "}
        <code>AUTH_SECRET</code> is actually set in the deployed environment. A
        missing secret produces the same message.
      </p>

      <p>
        <strong>&ldquo;No providers configured&rdquo;</strong> means neither
        credential pair is set. The sign-in page names the variables it is
        looking for. See <Link href="/docs/self-hosting">Self-hosting</Link>.
      </p>
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
    </DocPage>
  );
}
