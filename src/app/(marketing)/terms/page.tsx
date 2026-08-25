import { type Metadata } from "next";
import Link from "next/link";

import { BIIOS, SITE } from "~/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: `The terms for using the hosted version of ${SITE.name}.`,
  alternates: { canonical: "/terms" },
};

const UPDATED = "25 August 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 lg:py-24">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-4 text-[clamp(2rem,4.5vw,3rem)]">Terms of use</h1>
      <p className="mt-4 font-mono text-[0.75rem] tracking-[0.1em] text-muted">
        Last updated {UPDATED}
      </p>

      <div className="prose-tp mt-10">
        <p>
          These terms cover the hosted version of {SITE.name} at this domain,
          provided by {BIIOS.name} ({BIIOS.city}). The software itself is
          separately licensed under the {SITE.license} licence — see{" "}
          <Link href="/open-source">Open source</Link> — and if you run your own
          instance, only that licence applies.
        </p>

        <h2 id="service">The service</h2>
        <p>
          {SITE.name} is provided free of charge. There is no paid tier, no
          trial, and no feature held back from the open-source repository.
        </p>

        <h2 id="account">Your account</h2>
        <p>
          You sign in with Google or GitHub. You are responsible for the
          security of that account: anyone who can sign into it can reach your
          scripts and join your rooms, because that is precisely how device
          pairing works. Sign-ins that share a verified email address are
          treated as the same person.
        </p>
        <p>
          You must be old enough to hold an account with your sign-in provider
          in your jurisdiction.
        </p>

        <h2 id="content">Your content</h2>
        <p>
          Your scripts are yours. You keep every right you had in them, and
          nothing in these terms transfers ownership. We store and transmit them
          only to operate the service for you.
        </p>
        <p>
          You are responsible for what you write, and for having the right to
          use it. Do not use {SITE.name} to store or distribute unlawful
          material.
        </p>

        <h2 id="acceptable">Acceptable use</h2>
        <ul>
          <li>
            Do not attempt to reach another account&rsquo;s rooms, scripts or
            data.
          </li>
          <li>
            Do not attack the service — no automated abuse, no attempts to
            degrade it for other people.
          </li>
          <li>
            Do not resell access to the hosted instance. Run your own; the
            licence explicitly allows it.
          </li>
        </ul>
        <p>
          If you find a security issue, please report it privately rather than
          demonstrating it. Details are in the repository.
        </p>

        <h2 id="availability">Availability</h2>
        <p>
          The hosted instance is offered as it is, with no uptime commitment.
          For anything where downtime would be costly — a live broadcast, a paid
          shoot — run your own instance. The code is public and the setup takes
          about ten minutes.
        </p>
        <p>
          We may change, suspend or discontinue the hosted service. If we
          discontinue it, we will give reasonable notice so you can export your
          scripts.
        </p>

        <h2 id="warranty">No warranty</h2>
        <p>
          The service is provided &ldquo;as is&rdquo;, without warranties of any
          kind, express or implied, including merchantability, fitness for a
          particular purpose and non-infringement.
        </p>

        <h2 id="liability">Liability</h2>
        <p>
          To the fullest extent permitted by law, {BIIOS.name} is not liable for
          indirect, incidental, special or consequential damages, or for lost
          profits, revenue, data or goodwill, arising from your use of the
          hosted service.
        </p>
        <p>Nothing here excludes liability that cannot lawfully be excluded.</p>

        <h2 id="termination">Termination</h2>
        <p>
          You can stop using {SITE.name} at any time and ask for your account to
          be deleted. We may suspend an account that breaches these terms.
        </p>

        <h2 id="law">Governing law</h2>
        <p>
          These terms are governed by the laws of India, and the courts of Pune,
          Maharashtra have exclusive jurisdiction — without affecting any
          mandatory consumer protections available to you where you live.
        </p>

        <h2 id="contact">Contact</h2>
        <p>
          {BIIOS.name}, {BIIOS.city} —{" "}
          <a href={BIIOS.contact} rel="noreferrer noopener">
            biios.in/contact
          </a>
          .
        </p>
      </div>
    </main>
  );
}
