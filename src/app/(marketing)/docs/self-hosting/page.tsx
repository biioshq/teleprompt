import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";
import { SITE } from "~/lib/site";

const SLUG = "self-hosting";
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
        { id: "requirements", label: "What you need" },
        { id: "clone", label: "1. Clone and install" },
        { id: "supabase", label: "2. Supabase" },
        { id: "providers", label: "3. Sign-in providers" },
        { id: "env", label: "4. Environment" },
        { id: "schema", label: "5. Push the schema" },
        { id: "run", label: "6. Run it" },
        { id: "deploy", label: "Deploying" },
        { id: "reference", label: "Variable reference" },
      ]}
    >
      <h2 id="requirements">What you need</h2>
      <ul>
        <li>Node 20 or newer, and npm.</li>
        <li>A Supabase project — the free tier is enough.</li>
        <li>A Google Cloud project with an OAuth 2.0 client.</li>
      </ul>
      <p>
        There is no other service to sign up for. Postgres and the realtime
        relay both come from Supabase, and STUN comes from public servers.
      </p>

      <h2 id="clone">1. Clone and install</h2>
      <pre>
        <code>{`git clone ${SITE.repo}.git
cd teleprompt
npm install
cp .env.example .env`}</code>
      </pre>

      <h2 id="supabase">2. Supabase</h2>
      <ol>
        <li>
          Create a project at{" "}
          <a href="https://supabase.com" rel="noreferrer noopener">
            supabase.com
          </a>
          . Keep the database password you set.
        </li>
        <li>
          Go to <strong>Project Settings &rarr; API</strong> and copy the{" "}
          <strong>Project URL</strong> and the{" "}
          <strong>publishable / anon key</strong>. Both are public by design —
          they go into <code>NEXT_PUBLIC_</code> variables and ship to the
          browser.
        </li>
        <li>
          Go to <strong>Project Settings &rarr; Database</strong> and copy the{" "}
          <strong>Transaction pooler</strong> connection string. Read the note
          below before reaching for the direct one.
        </li>
      </ol>

      <Note tone="coral" title="Use a pooler, not the direct endpoint">
        The direct <code>db.&lt;ref&gt;.supabase.co</code> endpoint resolves to
        an <strong>IPv6 address only</strong> - it has no A record at all. Hosts
        without IPv6 egress, which includes Vercel&rsquo;s functions, simply
        cannot reach it.
        <br />
        <br />
        Nothing in the resulting error mentions the database. The adapter throws
        while Auth.js is handling the request, so what you actually see is{" "}
        <em>
          &ldquo;This deployment&rsquo;s sign-in is misconfigured&rdquo;
        </em>{" "}
        on the sign-in page, in production only, with the same environment
        variables that work locally.
        <br />
        <br />
        So use a pooler URI. Two things differ from the direct string: the host
        becomes <code>aws-0-&lt;region&gt;.pooler.supabase.com</code>, and the
        username becomes <code>postgres.&lt;project-ref&gt;</code> rather than
        plain <code>postgres</code>. Port 6543 is the transaction pooler, which
        suits serverless; port 5432 is the session pooler, which behaves like a
        direct connection. The app detects the transaction pooler and turns off
        prepared statements by itself. Append <code>?sslmode=require</code>{" "}
        either way.
      </Note>

      <p>
        Nothing else needs configuring in Supabase. Teleprompt does not use
        Supabase Auth or Storage, and it never reads a table from the browser,
        so there are no row-level security policies to write. Realtime broadcast
        works with the anon key out of the box, and access control is the
        room&rsquo;s 256-bit channel key — see{" "}
        <Link href="/docs/architecture">Architecture</Link>.
      </p>

      <h2 id="providers">3. Sign-in providers</h2>
      <p>
        Teleprompt supports Google and GitHub. Configure one, the other, or
        both: the sign-in page shows whichever have credentials and names the
        variables for whichever do not. You need at least one.
      </p>

      <h3>Google</h3>
      <ol>
        <li>
          Open the{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            rel="noreferrer noopener"
          >
            Google Cloud credentials console
          </a>{" "}
          and create an <strong>OAuth client ID</strong> of type{" "}
          <strong>Web application</strong>.
        </li>
        <li>
          Add authorised redirect URIs. One per origin you will use:
          <pre>
            <code>{`http://localhost:3000/api/auth/callback/google
https://your-domain.example/api/auth/callback/google`}</code>
          </pre>
        </li>
        <li>
          On the OAuth consent screen, the only scopes needed are the default
          email and profile scopes.
        </li>
        <li>
          Copy the client ID and client secret into <code>AUTH_GOOGLE_ID</code>{" "}
          and <code>AUTH_GOOGLE_SECRET</code>.
        </li>
      </ol>

      <h3>GitHub</h3>
      <ol>
        <li>
          Go to{" "}
          <a
            href="https://github.com/settings/developers"
            rel="noreferrer noopener"
          >
            Settings &rarr; Developer settings &rarr; OAuth Apps
          </a>{" "}
          and choose <strong>New OAuth App</strong>.
        </li>
        <li>
          Set the homepage URL to your origin and the{" "}
          <strong>Authorization callback URL</strong> to:
          <pre>
            <code>{`http://localhost:3000/api/auth/callback/github`}</code>
          </pre>
          A GitHub OAuth App accepts only <em>one</em> callback URL, so
          development and production need separate apps. This is the main way it
          differs from Google, which takes a list.
        </li>
        <li>
          Generate a client secret, then copy both into{" "}
          <code>AUTH_GITHUB_ID</code> and <code>AUTH_GITHUB_SECRET</code>.
        </li>
      </ol>

      <Note tone="blue" title="One person, one account">
        A room is the set of devices signed into one account, so somebody who
        uses Google on their laptop and GitHub on their phone has to land in the
        same account. Otherwise the join code would simply never resolve, with
        no error to explain why.
        <br />
        <br />
        Teleprompt therefore links accounts that share an email address, and
        only ever accepts an address the provider says is{" "}
        <strong>verified</strong>. Auth.js&rsquo;s stock GitHub provider takes
        the primary address without checking that flag; Teleprompt overrides it
        so an unverified address cannot be used to reach an existing account.
      </Note>

      <h2 id="env">4. Environment</h2>
      <p>
        Fill in <code>.env</code>. Generate the auth secret with{" "}
        <code>npx auth secret</code>, or any 32 random bytes in base64.
      </p>
      <pre>
        <code>{`AUTH_SECRET="…"
AUTH_TRUST_HOST="true"

# At least one provider.
AUTH_GOOGLE_ID="…apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="…"
AUTH_GITHUB_ID="…"
AUTH_GITHUB_SECRET="…"

DATABASE_URL="postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"

NEXT_PUBLIC_SUPABASE_URL="https://REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="…"

# Only off Vercel — see below. Bare hostname, no scheme.
# NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL="teleprompt.example"`}</code>
      </pre>
      <p>
        <code>AUTH_TRUST_HOST</code> is not optional outside Vercel. Without it
        Auth.js refuses to build callback URLs from the incoming Host header and
        sign-in fails with <code>UntrustedHost</code>.
      </p>

      <h2 id="schema">5. Push the schema</h2>
      <pre>
        <code>{`npm run db:push`}</code>
      </pre>
      <p>
        This creates seven tables, all prefixed <code>teleprompt_</code>, so the
        project can share a Supabase database with something else without
        colliding. <code>npm run db:studio</code> opens Drizzle Studio if you
        want to look at them.
      </p>
      <p>
        The push runs over whichever URL is in <code>DATABASE_URL</code>,
        including the transaction pooler. Session mode is not required for the
        migration, and not every project exposes it on the <code>aws-0</code>{" "}
        hostname, so reach for it only if the transaction pooler gives you
        trouble.
      </p>

      <h2 id="run">6. Run it</h2>
      <pre>
        <code>{`npm run dev        # http://localhost:3000
npm run typecheck  # no emit, strict
npm run build      # production build
npm run preview    # build, then serve it`}</code>
      </pre>
      <p>
        The service worker is only registered in production builds, so use{" "}
        <code>npm run preview</code> to test installing the app.
      </p>

      <h2 id="deploy">Deploying</h2>
      <Note tone="blue" title="Where the public origin comes from">
        Canonical links, Open Graph tags and the sitemap all need to know the
        site&rsquo;s real origin. Teleprompt reads it from{" "}
        <code>NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL</code> — a Vercel system
        variable that is populated automatically and, usefully, always points at
        production even from a preview deployment, so a preview never advertises
        itself as the real site. The value carries no scheme, so the app adds{" "}
        <code>https://</code> itself.
      </Note>
      <p>
        It is a standard Next.js App Router application with no edge-only or
        platform-specific code, so anywhere that runs Next works: Vercel,
        Netlify, Fly, Railway, a container on your own box.
      </p>
      <ul>
        <li>Set every variable above in the host&rsquo;s environment.</li>
        <li>
          <strong>On Vercel</strong>, the public origin is filled in for you:{" "}
          <code>NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL</code> is a system
          environment variable, provided you leave{" "}
          <em>Enable access to System Environment Variables</em> switched on.
          There is nothing to set.
        </li>
        <li>
          <strong>Anywhere else</strong>, set that same variable by hand to your
          own domain. It wants a bare hostname — <code>teleprompt.example</code>
          , not <code>https://teleprompt.example/</code>. Leave it unset and the
          app falls back to localhost, which will put localhost links in your
          sitemap and Open Graph tags.
        </li>
        <li>
          Add the production callback URL to every provider before you try to
          sign in. Google takes a list of redirect URIs; GitHub allows one per
          OAuth App, so production needs its own app.
        </li>
        <li>
          Serve over HTTPS. WebRTC, the service worker and the wake lock all
          require a secure context.
        </li>
      </ul>

      <h2 id="reference">Variable reference</h2>
      <table>
        <thead>
          <tr>
            <th>Variable</th>
            <th>Required</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>AUTH_SECRET</code>
            </td>
            <td>In production</td>
            <td>Signs the session cookie.</td>
          </tr>
          <tr>
            <td>
              <code>AUTH_GOOGLE_ID</code>, <code>AUTH_GOOGLE_SECRET</code>
            </td>
            <td>One provider</td>
            <td>
              Optional at build time; the sign-in page names whatever is
              missing.
            </td>
          </tr>
          <tr>
            <td>
              <code>AUTH_GITHUB_ID</code>, <code>AUTH_GITHUB_SECRET</code>
            </td>
            <td>One provider</td>
            <td>As above. At least one of the two pairs must be set.</td>
          </tr>
          <tr>
            <td>
              <code>AUTH_TRUST_HOST</code>
            </td>
            <td>Off Vercel</td>
            <td>
              Set to <code>true</code>.
            </td>
          </tr>
          <tr>
            <td>
              <code>DATABASE_URL</code>
            </td>
            <td>Yes</td>
            <td>
              Postgres. Use a pooler host, not the IPv6-only direct endpoint,
              and add <code>?sslmode=require</code>.
            </td>
          </tr>
          <tr>
            <td>
              <code>NEXT_PUBLIC_SUPABASE_URL</code>
            </td>
            <td>Yes</td>
            <td>Realtime endpoint. Public.</td>
          </tr>
          <tr>
            <td>
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            </td>
            <td>Yes</td>
            <td>Publishable key. Public.</td>
          </tr>
          <tr>
            <td>
              <code>NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL</code>
            </td>
            <td>Off Vercel</td>
            <td>
              Bare hostname, no scheme. Automatic on Vercel, and always the
              production domain even on a preview.
            </td>
          </tr>
          <tr>
            <td>
              <code>SKIP_ENV_VALIDATION</code>
            </td>
            <td>No</td>
            <td>Escape hatch for container builds.</td>
          </tr>
        </tbody>
      </table>
    </DocPage>
  );
}
