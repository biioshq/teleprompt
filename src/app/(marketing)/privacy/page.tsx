import { type Metadata } from "next";
import Link from "next/link";

import { BIIOS, SITE } from "~/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Teleprompt stores, who processes it, and how to have it deleted.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "25 August 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl py-16 gutter lg:py-24">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-4 text-[clamp(2rem,4.5vw,3rem)]">Privacy notice</h1>
      <p className="mt-4 font-mono text-[0.75rem] tracking-[0.1em] text-muted">
        Last updated {UPDATED}
      </p>

      <div className="prose-tp mt-10">
        <p>
          This notice covers the hosted version of {SITE.name}, operated by{" "}
          {BIIOS.name} ({BIIOS.city}). If you run your own instance, none of
          your data reaches us and this notice does not apply to it;{" "}
          <Link href="/docs/self-hosting">Running your own</Link> explains what
          that involves.
        </p>
        <p>
          The engineering detail behind all of this is in{" "}
          <Link href="/docs/privacy-and-data">Privacy and data</Link>, which
          lists the exact tables and the exact browser storage keys.
        </p>

        <h2 id="collect">What we collect</h2>
        <ul>
          <li>
            <strong>Account information from your sign-in provider.</strong>{" "}
            Google or GitHub, whichever you use: your name, email address and
            profile image, plus the OAuth tokens needed to keep you signed in.
            We request only the scopes needed to read that basic profile and a
            verified email address.
          </li>
          <li>
            <strong>Content you create.</strong> The scripts you write, and the
            rooms you open (including the snapshot of the script a room is using
            and its playback state).
          </li>
          <li>
            <strong>Device labels.</strong> A readable platform string such as
            &ldquo;iPhone · Safari&rdquo;, and a random identifier generated in
            your browser, so the connected-devices list is meaningful. Neither
            is derived from your hardware.
          </li>
          <li>
            <strong>Ordinary server logs.</strong> Requests, timestamps and
            error traces, kept only as long as they are useful for keeping the
            service running.
          </li>
        </ul>

        <h2 id="not">What we do not collect</h2>
        <ul>
          <li>
            No analytics, advertising identifiers, tag managers or third-party
            trackers.
          </li>
          <li>
            No audio or video reaches us, ever. Camera access is never requested
            at all. The microphone is requested in exactly one place (voice
            tracking, which only listens while you hold it on), and even then
            the audio goes to your browser&rsquo;s own speech recognition, never
            to us: we receive no audio and store no transcript. See{" "}
            <Link href="/docs/privacy-and-data#voice">Privacy and data</Link>{" "}
            for exactly what each browser does with it.
          </li>
          <li>
            No use of your content for advertising, resale, or training any
            model.
          </li>
        </ul>

        <h2 id="why">Why we hold it</h2>
        <p>
          To provide the service you asked for: to identify your account, to
          show your scripts on your other device, and to let a session resume
          after a reload. That is the entire purpose, and we do not process this
          data for anything else.
        </p>

        <h2 id="processors">Who processes it</h2>
        <ul>
          <li>
            <strong>Google and GitHub</strong>, for authentication only, and
            only the one you sign in with.
          </li>
          <li>
            <strong>Supabase</strong>, the Postgres database and the realtime
            relay.
          </li>
          <li>
            <strong>Our hosting provider</strong>, serving the application.
          </li>
          <li>
            <strong>Public STUN servers</strong>, consulted while two of your
            devices look for a direct route. They observe IP addresses during
            connection setup and never see message content.
          </li>
        </ul>
        <p>
          When your two devices establish a direct connection, the messages
          between them are encrypted end to end and reach none of the parties
          above.
        </p>

        <h2 id="retention">How long</h2>
        <p>
          Scripts stay until you delete them or delete your account. Rooms close
          themselves after five quiet minutes, and their device records are
          deleted when they do. Deleting your account removes everything
          attached to it; the schema cascades from the user record, so nothing
          is left orphaned.
        </p>

        <h2 id="rights">Your rights</h2>
        <p>
          You can access, correct, export or delete your data. Scripts and rooms
          can be deleted from inside the app at any time. For an export or full
          account deletion, get in touch through{" "}
          <a href={BIIOS.contact} rel="noreferrer noopener">
            biios.in/contact
          </a>{" "}
          using the email address on the account, and we will action it.
        </p>
        <p>
          If you are in a jurisdiction with statutory data-protection rights,
          such as the UK or EU, those rights apply and this section does not
          limit them.
        </p>

        <h2 id="cookies">Cookies</h2>
        <p>
          One cookie: the Auth.js session cookie that keeps you signed in. It is
          strictly necessary, and there are no analytics or advertising cookies,
          which is why there is no consent banner.
        </p>

        <h2 id="children">Children</h2>
        <p>
          Teleprompt is not directed at children under 13, and we do not
          knowingly collect their data.
        </p>

        <h2 id="changes">Changes</h2>
        <p>
          If this notice changes materially we will update the date above and
          note it in the repository&rsquo;s history, which is public.
        </p>

        <h2 id="contact">Contact</h2>
        <p>
          {BIIOS.name}, {BIIOS.city}:{" "}
          <a href={BIIOS.contact} rel="noreferrer noopener">
            biios.in/contact
          </a>
          .
        </p>
      </div>
    </main>
  );
}
