import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "privacy-and-data";
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
        { id: "stored", label: "What is stored" },
        { id: "not", label: "What is not" },
        { id: "where", label: "Where it lives" },
        { id: "browser", label: "What stays in the browser" },
        { id: "wire", label: "What crosses the network" },
        { id: "delete", label: "Deleting things" },
      ]}
    >
      <h2 id="stored">What is stored</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Name, email address, profile image from your provider</td>
            <td>
              To identify the account, and so you can tell which account a
              device is signed into. The verified email address is also what
              links a Google sign-in and a GitHub sign-in into one account.
            </td>
          </tr>
          <tr>
            <td>OAuth tokens from your provider</td>
            <td>
              To keep you signed in. Stored server-side, never sent to the
              browser.
            </td>
          </tr>
          <tr>
            <td>Your scripts</td>
            <td>So they are there on the other device.</td>
          </tr>
          <tr>
            <td>Rooms: the script snapshot, the state, the join code</td>
            <td>
              So a device that reloads mid-session lands where it left off.
            </td>
          </tr>
          <tr>
            <td>
              Device labels: a platform string such as
              &ldquo;iPhone&nbsp;·&nbsp;Safari&rdquo;
            </td>
            <td>
              So the connected-devices list is readable. No hardware
              identifiers.
            </td>
          </tr>
        </tbody>
      </table>

      <h2 id="not">What is not</h2>
      <ul>
        <li>No analytics, no tag manager, no third-party trackers.</li>
        <li>
          No recording of anything you say. Teleprompt has no microphone or
          camera access at all.
        </li>
        <li>No advertising identifiers, no fingerprinting.</li>
        <li>
          No content sold, shared or used to train anything. Your scripts are
          yours.
        </li>
      </ul>

      <Note title="Third parties in the path">
        Google and GitHub, for sign-in, and only the one you use. Supabase,
        which hosts the Postgres database and the realtime relay. Public STUN
        servers, which help two devices discover a direct route — they see IP
        addresses during connection setup, never message content.
      </Note>

      <h2 id="where">Where it lives</h2>
      <p>
        Everything is in one Postgres database in a Supabase project, in seven
        tables prefixed <code>teleprompt_</code>. On the hosted instance that is
        our project; if you <Link href="/docs/self-hosting">run your own</Link>,
        it is yours, and nothing reaches us at all.
      </p>

      <h2 id="browser">What stays in the browser</h2>
      <p>
        Two values in <code>localStorage</code>, and neither ever leaves the
        device except as described below:
      </p>
      <ul>
        <li>
          <code>teleprompt.device</code> — a random 128-bit identifier generated
          in your browser. It is the presence key on the realtime channel and
          the address for WebRTC signalling. It is not derived from anything
          about your hardware, and clearing site data regenerates it.
        </li>
        <li>
          <code>teleprompt.device.label</code> — the readable name shown in the
          devices list.
        </li>
      </ul>
      <p>
        The service worker caches the app shell and pages you have visited. It
        never caches API responses, so no script content is written to the HTTP
        cache.
      </p>

      <h2 id="wire">What crosses the network</h2>
      <p>
        During a session, the messages between your devices carry the playback
        state — an anchor, a play flag, and the display settings. The script
        text itself is fetched over HTTPS from the server by each device
        separately; it is not streamed peer to peer.
      </p>
      <p>
        When a direct WebRTC channel is open, those messages are encrypted
        end-to-end by DTLS and do not pass through any server. When it falls
        back to the relay, they pass through Supabase Realtime over TLS.
      </p>

      <h2 id="delete">Deleting things</h2>
      <ul>
        <li>
          Deleting a script deletes it, and detaches it from any room that used
          it.
        </li>
        <li>
          Ending a room deletes its device records. The room row itself is
          marked ended.
        </li>
        <li>
          To delete an account and everything attached to it, email the address
          in the <Link href="/privacy">privacy notice</Link>. Every table
          cascades from the user row, so removal is complete rather than
          cosmetic.
        </li>
      </ul>
    </DocPage>
  );
}
