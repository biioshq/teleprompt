import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";
import { BIIOS, SITE } from "~/lib/site";

const SLUG = "contributing";
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
        { id: "layout", label: "Repository layout" },
        { id: "setup", label: "Getting set up" },
        { id: "conventions", label: "Conventions" },
        { id: "testing", label: "Testing a change by hand" },
        { id: "wanted", label: "Wanted" },
        { id: "sending", label: "Sending a change" },
      ]}
    >
      <h2 id="layout">Repository layout</h2>
      <pre>
        <code>{`src/
  app/                     routes
    (marketing)/           public site and docs
    (app)/                 signed-in surfaces
    prompter/[roomId]/     the display
    remote/[roomId]/       the remote
  components/
    brand/  ui/  marketing/  docs/  app/  pwa/
    prompter/              engine, canvas, session hooks
  lib/
    markdown/blocks.ts     deterministic script splitter
    prompter/state.ts      state shape, limits, themes
    realtime/              protocol, link, WebRTC mesh
  server/
    api/routers/           tRPC: script, room
    auth/                  Auth.js config and guards
    db/                    Drizzle schema and client
scripts/
  generate-brand-assets.mjs   renders the app icons`}</code>
      </pre>

      <h2 id="setup">Getting set up</h2>
      <p>
        Follow <Link href="/docs/self-hosting">Self-hosting</Link>; a
        contributor setup and a self-hosted setup are the same thing. You need
        your own Supabase project and at least one OAuth client of your own;
        there is no shared development backend.
      </p>

      <h2 id="conventions">Conventions</h2>
      <ul>
        <li>
          <strong>TypeScript is strict</strong>, including{" "}
          <code>noUncheckedIndexedAccess</code>. <code>npm run typecheck</code>{" "}
          has to pass.
        </li>
        <li>
          <strong>Prettier decides formatting.</strong>{" "}
          <code>npm run format</code> before you commit.
        </li>
        <li>
          <strong>Anything off the network is validated with Zod</strong> before
          it is used, on both the tRPC boundary and the realtime one.
        </li>
        <li>
          <strong>The frame loop does not touch React.</strong> If you are
          adding something that runs per frame, it belongs in the engine, not in
          state.
        </li>
        <li>
          <strong>Comments explain decisions, not mechanics.</strong> Say why
          the anchor is not a scroll offset; do not narrate what the next line
          does.
        </li>
        <li>
          <strong>No emoji in the interface</strong>, and no placeholder copy.
          Every string is real.
        </li>
      </ul>

      <h2 id="testing">Testing a change by hand</h2>
      <p>
        There is no substitute for two real devices. The sync path in particular
        cannot be exercised in one browser window, because the WebRTC tie-break
        and the presence ordering both depend on there being two device keys.
      </p>
      <ol>
        <li>
          Run <code>npm run dev</code> and open the display on your computer.
        </li>
        <li>
          Reach the dev server from your phone on the same network, or use a
          tunnel. Remember that WebRTC and the wake lock need a secure context,
          so a tunnel with HTTPS is more representative than a LAN IP.
        </li>
        <li>
          Check the badge on both devices. If it says Direct, the peer path is
          live; if it says Relay, you are exercising the fallback.
        </li>
        <li>
          Test a reload mid-session. Persistence is easy to break and easy to
          miss.
        </li>
      </ol>

      <Note title="Worth knowing">
        Force the relay path by disabling WebRTC in the browser, or by putting
        one device on a network that blocks UDP. Both paths need to work, and
        the relay one is the one users on venue Wi-Fi will actually get.
      </Note>

      <h2 id="wanted">Wanted</h2>
      <ul>
        <li>
          <strong>TURN support.</strong> An optional, configurable TURN server
          so direct routes are possible on hostile networks.
        </li>
        <li>
          <strong>Import.</strong> Google Docs, plain text, and a paste handler
          that converts formatting to Markdown.
        </li>
        <li>
          <strong>Timed segments.</strong> A per-section target duration with a
          countdown on the remote.
        </li>
        <li>
          <strong>Foot pedals.</strong> Gamepad API mapping, so a pedal can
          drive play and step.
        </li>
        <li>
          <strong>Accessibility.</strong> Screen-reader behaviour on the
          prompter surface deserves a proper look.
        </li>
      </ul>

      <h2 id="sending">Sending a change</h2>
      <ol>
        <li>
          Open an issue first for anything that changes the sync protocol or the
          data model.
        </li>
        <li>Branch, make the change, run typecheck and format.</li>
        <li>
          Describe what you tested and on which devices. &ldquo;Two devices,
          same Wi-Fi, direct&rdquo; is useful; &ldquo;works for me&rdquo; is
          not.
        </li>
        <li>
          Open a pull request against{" "}
          <a href={SITE.repo} rel="noreferrer noopener">
            the repository
          </a>
          .
        </li>
      </ol>
      <p>
        Teleprompt is {SITE.license} licensed and maintained by {BIIOS.name}.
        Contributions are accepted under the same licence.
      </p>
    </DocPage>
  );
}
