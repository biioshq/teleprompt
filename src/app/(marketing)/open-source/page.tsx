import { type Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, GithubLogo } from "@phosphor-icons/react/dist/ssr";

import { BiiosWordmark } from "~/components/brand/logo";
import { ButtonLink } from "~/components/ui/button";
import { BIIOS, SITE } from "~/lib/site";

export const metadata: Metadata = {
  title: "Open source",
  description: `${SITE.name} is ${SITE.license} licensed. The repository is the same code that runs the hosted instance.`,
  alternates: { canonical: "/open-source" },
};

const DEPENDENCIES = [
  { name: "Next.js", licence: "MIT", role: "App Router, RSC, the build" },
  { name: "React", licence: "MIT", role: "The interface" },
  { name: "TypeScript", licence: "Apache-2.0", role: "The whole codebase" },
  { name: "tRPC", licence: "MIT", role: "Typed client-server calls" },
  { name: "TanStack Query", licence: "MIT", role: "Client cache" },
  { name: "Tailwind CSS", licence: "MIT", role: "The design tokens" },
  { name: "Drizzle ORM", licence: "Apache-2.0", role: "Schema and queries" },
  { name: "Auth.js", licence: "ISC", role: "Google and GitHub sign-in" },
  { name: "supabase-js", licence: "MIT", role: "The realtime channel" },
  { name: "Zod", licence: "MIT", role: "Every trust boundary" },
  {
    name: "@uiw/react-md-editor",
    licence: "MIT",
    role: "The Markdown editor",
  },
  { name: "react-markdown", licence: "MIT", role: "Rendering blocks" },
  { name: "Phosphor Icons", licence: "MIT", role: "Iconography" },
  {
    name: "Familjen Grotesk, Plus Jakarta Sans, JetBrains Mono, Bebas Neue",
    licence: "SIL OFL 1.1",
    role: "Typography",
  },
];

export default function OpenSourcePage() {
  return (
    <main className="mx-auto max-w-3xl py-16 gutter lg:py-24">
      <p className="eyebrow">Open source</p>
      <h1 className="mt-4 text-[clamp(2rem,4.5vw,3rem)]">
        {SITE.license} licensed, and the repository is the real one.
      </h1>
      <p className="mt-5 text-[1.0625rem] leading-relaxed text-muted">
        There is no separate internal version of {SITE.name}. What runs here is
        what is in the repository, and the hosted instance exists so that people
        who do not want to run infrastructure do not have to.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href={SITE.repo} variant="primary">
          <GithubLogo size={16} weight="bold" />
          View the source
        </ButtonLink>
        <ButtonLink href="/docs/self-hosting" variant="outline">
          Run your own
        </ButtonLink>
      </div>

      <div className="prose-tp mt-14">
        <h2 id="licence">The licence</h2>
        <p>
          {SITE.name} is released under the MIT licence. In plain terms: use it
          commercially, modify it, redistribute it, build a product on it. Keep
          the copyright notice, and accept that it comes with no warranty.
        </p>
        <pre>
          <code>{`MIT License

Copyright (c) ${new Date().getFullYear()} Biios

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`}</code>
        </pre>

        <h2 id="why">Why it is open</h2>
        <p>
          {SITE.name} was built at {BIIOS.name} because founder videos and
          launch films kept needing a prompter that a second person could drive,
          and the options were either a hardware rig or an app with a
          subscription attached to a scroll bar.
        </p>
        <p>
          Once it existed, keeping it private would have meant maintaining a
          tool nobody could improve. So it is given to the community as it is
          used internally — same code, no held-back tier.
        </p>
        <p className="font-mono text-[0.8125rem]">
          Built with {"<3"} by {BIIOS.name} for the Community.
        </p>

        <h2 id="thanks">Standing on</h2>
        <p>
          {SITE.name} is a thin layer over a lot of other people&rsquo;s work.
          The significant pieces, and what each is doing here:
        </p>
      </div>

      <div className="mt-6 overflow-x-auto rounded-sm border border-line bg-surface">
        <table className="w-full text-left text-[0.875rem]">
          <thead>
            <tr className="border-b border-line bg-paper-deep">
              <th className="px-4 py-3 font-mono text-[0.625rem] tracking-[0.14em] text-muted uppercase">
                Project
              </th>
              <th className="px-4 py-3 font-mono text-[0.625rem] tracking-[0.14em] text-muted uppercase">
                Licence
              </th>
              <th className="px-4 py-3 font-mono text-[0.625rem] tracking-[0.14em] text-muted uppercase">
                Doing what
              </th>
            </tr>
          </thead>
          <tbody>
            {DEPENDENCIES.map((dependency) => (
              <tr
                key={dependency.name}
                className="border-b border-line last:border-b-0"
              >
                <td className="px-4 py-3 font-medium text-ink">
                  {dependency.name}
                </td>
                <td className="px-4 py-3 font-mono text-[0.75rem] text-muted">
                  {dependency.licence}
                </td>
                <td className="px-4 py-3 text-muted">{dependency.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose-tp mt-12">
        <h2 id="contribute">Contributing</h2>
        <p>
          Issues and pull requests are welcome. The{" "}
          <Link href="/docs/contributing">contributing guide</Link> covers the
          repository layout, the conventions, and how to test a sync change
          properly — which needs two real devices, because the interesting parts
          cannot be exercised in one browser window.
        </p>
      </div>

      <div className="mt-12 rounded-md border border-ink bg-ink p-7 text-paper">
        <a
          href={BIIOS.url}
          target="_blank"
          rel="noreferrer noopener"
          className="group inline-flex items-baseline gap-2"
        >
          <BiiosWordmark className="text-2xl text-white" />
          <ArrowUpRight
            size={16}
            weight="bold"
            className="text-brand transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </a>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-white/60">
          {BIIOS.tagline} {BIIOS.mission}
        </p>
        <a
          href={BIIOS.contact}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-block text-sm text-white underline decoration-[var(--color-brand)] decoration-2 underline-offset-4"
        >
          Work with Biios
        </a>
      </div>
    </main>
  );
}
