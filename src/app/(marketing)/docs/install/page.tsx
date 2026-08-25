import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
import { InstallPrompt } from "~/components/pwa/install-prompt";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "install";
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
        { id: "why", label: "Why install it" },
        { id: "here", label: "Install from this page" },
        { id: "ios", label: "iPhone and iPad" },
        { id: "android", label: "Android" },
        { id: "desktop", label: "macOS and Windows" },
        { id: "offline", label: "What works offline" },
      ]}
    >
      <h2 id="why">Why install it</h2>
      <p>
        Teleprompt is a progressive web app, so installing it is not a download
        — it is the same site, given its own icon, its own window and no browser
        chrome. That matters more than it sounds:
      </p>
      <ul>
        <li>
          The display gets the full screen, with no URL bar collapsing halfway
          through a take.
        </li>
        <li>
          The remote launches straight into your scripts instead of a browser
          tab you have to find.
        </li>
        <li>
          The app shell is kept on the device, so a slow venue network cannot
          leave you looking at a browser error two minutes before you go on.
        </li>
        <li>There is a home-screen shortcut that opens the remote directly.</li>
      </ul>

      <h2 id="here">Install from this page</h2>
      <div className="not-prose my-6">
        <InstallPrompt />
      </div>

      <h2 id="ios">iPhone and iPad</h2>
      <p>
        Safari does not offer an install API, so this one is manual — and it has
        to be Safari; Chrome on iOS cannot add to the home screen.
      </p>
      <ol>
        <li>Open Teleprompt in Safari.</li>
        <li>Tap the Share button in the toolbar.</li>
        <li>
          Scroll down and choose <strong>Add to Home Screen</strong>.
        </li>
        <li>
          Confirm, then launch Teleprompt from the home screen rather than from
          Safari.
        </li>
      </ol>

      <Note tone="blue" title="iOS note">
        Launched from the home screen, the app gets its own storage and its own
        sign-in session. You will be asked to sign in once more the first time,
        and then not again.
      </Note>

      <h2 id="android">Android</h2>
      <p>
        Chrome, Edge and Samsung Internet all support installing directly. Use
        the button above, or open the browser menu and choose{" "}
        <strong>Install app</strong> / <strong>Add to Home screen</strong>.
      </p>

      <h2 id="desktop">macOS and Windows</h2>
      <p>
        In Chrome or Edge, look for the install icon at the right-hand end of
        the address bar, or open the menu and choose{" "}
        <strong>Install Teleprompt</strong>. In Safari on macOS, use{" "}
        <strong>File &rarr; Add to Dock</strong>.
      </p>
      <p>
        A desktop install is genuinely useful for the display role: it opens in
        a window with no tabs, which is one fewer thing that can appear on a
        shared screen.
      </p>

      <h2 id="offline">What works offline</h2>
      <p>
        The service worker keeps the app shell, the icons and pages you have
        already visited. Navigations are network-first with a short timeout, so
        you always get the live page when the network is reachable and a real
        offline page when it is not.
      </p>
      <p>
        API responses are <strong>never</strong> cached. A stale script or a
        stale room state would be worse than an error, so those always go to the
        server.
      </p>
      <p>
        A live room needs a connection in any case — the two devices have to
        find each other before they can talk directly. See{" "}
        <Link href="/docs/troubleshooting">Troubleshooting</Link> if a session
        will not connect.
      </p>
    </DocPage>
  );
}
