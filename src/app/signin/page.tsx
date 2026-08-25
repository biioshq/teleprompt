import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  GithubLogo,
  GoogleLogo,
  Lightning,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";

import { Cue } from "~/components/brand/cue";
import { Logo, Mark } from "~/components/brand/logo";
import { Badge } from "~/components/ui/badge";
import { buttonClasses } from "~/components/ui/button";
import { BIIOS, SITE } from "~/lib/site";
import { auth } from "~/server/auth";
import { signInAction } from "~/server/auth/actions";
import { AUTH_PROVIDERS, hasAnyProvider } from "~/server/auth/config";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in with Google or GitHub to write scripts and pair your devices. A room is the set of devices signed into one account.",
};

const PROVIDER_ICONS = {
  google: GoogleLogo,
  github: GithubLogo,
} as const;

const ERRORS: Record<string, string> = {
  NoVerifiedEmail:
    "That account has no verified email address. Verify your email with the provider and try again - Teleprompt uses it to recognise your other devices.",
  OAuthAccountNotLinked:
    "That email address is already on this site under a different provider. Use the button you signed up with.",
  AccessDenied: "Sign-in was declined. Nothing has been created.",
  Configuration:
    "This deployment's sign-in is misconfigured. If it is yours, check the provider credentials.",
};

function safeNext(value: string | undefined) {
  // Only same-origin paths, so `next` can never be turned into an open redirect.
  if (!value?.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeNext(next);

  const session = await auth();
  if (session?.user) redirect(target);

  const available = AUTH_PROVIDERS.filter((provider) => provider.configured);
  const missing = AUTH_PROVIDERS.filter((provider) => !provider.configured);

  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel -------------------------------------------------------- */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-paper lg:flex">
        <Link href="/" className="relative z-10 inline-flex">
          <Logo wordmarkClassName="text-paper text-lg" />
        </Link>

        <div className="relative z-10 max-w-md">
          <Cue tone="ink">why an account</Cue>
          <h1 className="mt-5 text-4xl leading-[1.05]">
            A room is simply the devices signed in as you.
          </h1>
          <p className="mt-6 text-[0.9375rem] leading-relaxed text-white/60">
            There is no invite flow and no shared link to leak. Your laptop and
            your phone find each other because they are both you, and a device
            that is not on your account cannot even learn the name of the
            channel they talk on.
          </p>

          <dl className="mt-10 space-y-5">
            <div className="flex gap-3">
              <ShieldCheck
                size={18}
                weight="bold"
                className="mt-0.5 shrink-0 text-brand"
              />
              <div>
                <dt className="text-sm font-medium">
                  One identity, either door
                </dt>
                <dd className="mt-1 text-sm text-white/50">
                  Google on the laptop and GitHub on the phone still land in the
                  same account, as long as the verified email matches.
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Lightning
                size={18}
                weight="bold"
                className="mt-0.5 shrink-0 text-brand"
              />
              <div>
                <dt className="text-sm font-medium">
                  Direct between your devices
                </dt>
                <dd className="mt-1 text-sm text-white/50">
                  Once paired, the scroll position travels peer-to-peer.
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <p className="relative z-10 font-mono text-[0.6875rem] tracking-[0.14em] text-white/35 uppercase">
          Built with care by {BIIOS.name}, {BIIOS.city}
        </p>

        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,136,0,0.16) 0%, transparent 68%)",
          }}
        />
      </section>

      {/* Form panel --------------------------------------------------------- */}
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="inline-flex lg:hidden">
            <Mark className="h-9 w-9" />
          </Link>

          <h2 className="mt-8 text-3xl lg:mt-0">Sign in to {SITE.name}</h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
            Same account on both devices. That is the whole pairing step.
          </p>

          {error ? (
            <p className="mt-6 rounded-sm border border-coral bg-coral-soft px-4 py-3 text-sm leading-relaxed text-coral">
              {ERRORS[error] ?? "Sign-in did not complete. Please try again."}
            </p>
          ) : null}

          {hasAnyProvider ? (
            <div className="mt-8 space-y-3">
              {available.map((provider, index) => {
                const Icon = PROVIDER_ICONS[provider.id];
                return (
                  <form
                    key={provider.id}
                    action={signInAction.bind(null, provider.id, target)}
                  >
                    <button
                      type="submit"
                      className={buttonClasses({
                        variant: index === 0 ? "primary" : "outline",
                        size: "lg",
                        className: "w-full",
                      })}
                    >
                      <Icon size={19} weight="bold" />
                      Continue with {provider.label}
                    </button>
                  </form>
                );
              })}
            </div>
          ) : (
            <div className="mt-8 rounded-sm border border-line bg-surface p-5">
              <Badge tone="coral">No providers configured</Badge>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                This deployment has no OAuth credentials yet. Add at least one
                provider to{" "}
                <code className="font-mono text-[0.8125rem]">.env</code> and
                restart.
              </p>
              <Link
                href="/docs/self-hosting"
                className="mt-4 inline-block text-sm text-ink underline decoration-brand decoration-2 underline-offset-4"
              >
                Setup guide
              </Link>
            </div>
          )}

          {hasAnyProvider && missing.length > 0 ? (
            <p className="mt-4 text-[0.75rem] leading-relaxed text-faint">
              {missing.map((provider) => provider.label).join(" and ")} sign-in
              is available but not configured here. Add{" "}
              {missing
                .flatMap((provider) => provider.variables)
                .map((variable) => (
                  <code key={variable} className="font-mono">
                    {variable}
                  </code>
                ))
                .reduce<React.ReactNode[]>(
                  (all, node, index) =>
                    index === 0 ? [node] : [...all, ", ", node],
                  [],
                )}{" "}
              to enable it.
            </p>
          ) : null}

          <p className="mt-8 text-[0.8125rem] leading-relaxed text-faint">
            By continuing you agree to the{" "}
            <Link
              href="/terms"
              className="text-muted underline underline-offset-2"
            >
              terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-muted underline underline-offset-2"
            >
              privacy notice
            </Link>
            . Teleprompt stores your name, email and profile image, plus the
            scripts you write. Nothing else.
          </p>
        </div>
      </section>
    </main>
  );
}
