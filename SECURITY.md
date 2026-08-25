# Security

## Reporting a vulnerability

Please report security issues privately, through
[biios.in/contact](https://biios.in/contact), with `Teleprompt security` in the
subject. Do not open a public issue, and please do not demonstrate a finding
against the hosted instance beyond what is needed to confirm it.

Include what you can: the affected version or commit, reproduction steps, and
what an attacker would gain. We will acknowledge receipt, tell you what we
think, and let you know when a fix ships. If you would like credit in the
release notes, say so.

## Scope

In scope:

- The hosted instance at the project's public domain.
- Anything in this repository.

Out of scope:

- Findings in Supabase, Google, GitHub or the hosting provider. Report those to
  them.
- Denial of service, volumetric testing, and automated scanner output without a
  demonstrated impact.
- Missing hardening headers with no exploitable consequence.

## Design notes relevant to a review

These are the deliberate decisions most likely to come up:

- **Room access is account-scoped.** Every tRPC procedure touching a room checks
  ownership against the session. There is no unauthenticated path to a room.
- **The realtime channel is named by a secret.** Each room carries a 256-bit
  random `channelKey`. It is returned by exactly one endpoint, and only to a
  signed-in device on the owning account. Anyone who learns a channel key can
  observe and inject messages on that channel, which is why it is never exposed
  anywhere else — findings that leak it are high severity.
- **The join code is not a credential.** It is a lookup key scoped to an
  account. Possessing a code without the account grants nothing.
- **The browser holds only the Supabase publishable key** and never reads or
  writes a table with it. All data access goes through tRPC on the server, which
  is why there are no RLS policies.
- **Every inbound message is schema-validated** with Zod before it is acted on,
  on both the tRPC boundary and the realtime one.
- **`next` on the sign-in page is restricted to same-origin paths**, to keep it
  from becoming an open redirect. The provider id passed to the sign-in server
  action is validated against the configured providers rather than trusted.
- **Accounts are linked by verified email**, deliberately. A room is the set of
  devices signed into one account, so a person using Google on one device and
  GitHub on another must end up in a single account;
  `allowDangerousEmailAccountLinking` is enabled on both providers to make that
  happen. The risk that flag names is providers returning addresses they have
  not verified, so it is closed at the source: Auth.js's stock GitHub provider
  takes the primary address from `/user/emails` **without checking
  `verified`**, and `src/server/auth/config.ts` overrides `userinfo` to accept
  only a verified address. Google profiles reporting `email_verified: false`
  are refused in the `signIn` callback. A path that gets an unverified address
  past either guard is an account-takeover bug: high severity.

## Supported versions

The `main` branch is the supported version. Fixes land there first.
