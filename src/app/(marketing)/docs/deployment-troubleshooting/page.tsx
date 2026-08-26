import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "deployment-troubleshooting";
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
        { id: "health", label: "The health check" },
        { id: "prod-only", label: "Works locally, fails deployed" },
        { id: "signin", label: "Sign-in fails" },
        { id: "build-env", label: "Build-time variables" },
        { id: "db-push", label: "db:push crashes" },
      ]}
    >
      <p>
        Everything here is about a Teleprompt instance you are hosting yourself:
        a deployment that will not sign anyone in, a database it cannot reach, a
        CLI that stops with a stack trace. The setup itself is on{" "}
        <Link href="/docs/self-hosting">Running your own</Link>.
      </p>

      <h2 id="health">The health check</h2>
      <p>
        Start here, because Auth.js reports every internal failure as the same
        generic <em>&ldquo;misconfigured&rdquo;</em> sentence and the browser
        gives you nothing to go on:
      </p>
      <pre>
        <code>{`curl -s https://your-domain.example/api/health`}</code>
      </pre>
      <p>
        It answers the questions that error cannot. <code>database.ok</code>{" "}
        false with an error code means the deployment cannot reach Postgres at
        all; <code>ENETUNREACH</code> or <code>ENOTFOUND</code> points straight
        at the IPv6 problem below. <code>database.tables</code> below seven
        means it connected but was never migrated.{" "}
        <code>database.canWrite</code> false means the role can read but not
        create users. <code>auth.secret</code> false means{" "}
        <code>AUTH_SECRET</code> is missing, which produces the identical
        message. <code>auth.providers</code> empty means no credentials.
      </p>
      <p>
        Everything it returns is a boolean, a count, a duration or an error
        code. No connection string, no secret, no hostname.
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
      <p>
        <strong>&ldquo;No providers configured&rdquo;</strong> means neither
        credential pair is set. The sign-in page names the variables it is
        looking for. See <Link href="/docs/self-hosting">Running your own</Link>
        .
      </p>

      <h2 id="build-env">Build-time variables</h2>
      <p>
        If a device sits on <em>Connecting</em> and never joins the room, check
        that <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set in the <em>build</em>{" "}
        environment: they are inlined at build time, so setting them only at
        runtime leaves the client with nothing to connect to.
      </p>

      <h2 id="db-push">
        <code>db:push</code> crashes with a TypeError
      </h2>
      <p>
        If <code>npm run db:push</code> stops during{" "}
        <em>Pulling schema from database</em> with something like{" "}
        <code>
          TypeError: Cannot read properties of undefined (reading
          &lsquo;replace&rsquo;)
        </code>{" "}
        pointing inside <code>drizzle-kit/bin.cjs</code>, the problem is the
        connection, not your schema.
      </p>
      <p>
        Supabase&rsquo;s transaction pooler on port 6543 is the right choice for
        the app and the wrong one for the Drizzle CLI. The CLI introspects by
        firing a burst of small per-table queries, and on that pooler some
        answers come back matched to the wrong question: the check-constraint
        reader is handed a row from the foreign-key query, which has no
        definition to read. It only becomes fatal once the schema contains a
        single <code>CHECK</code> constraint anywhere, because until then that
        code never runs, so it appears the day you add one and looks like your
        fault.
      </p>
      <p>
        <code>drizzle.config.ts</code> already handles this by using port 5432
        for CLI work, which keeps one connection for the whole run. If your
        setup does not match that substitution, set{" "}
        <code>DIRECT_DATABASE_URL</code> to a session-mode connection and it
        will be used instead. Nothing about the app&rsquo;s own connection
        changes.
      </p>
    </DocPage>
  );
}
