<div align="center">

<img src="public/icons/icon-192.png" width="76" height="76" alt="Teleprompt" />

# teleprompt

**Your script, on both screens.**

A peer-to-peer teleprompter. One device shows the words, another drives them.

[Documentation](https://github.com/biioshq/teleprompt#documentation) ·
[Self-hosting](#self-hosting) ·
[Architecture](#how-the-sync-works) ·
[Licence](#licence)

we &lt;3 open source

</div>

---

## What it is

Write a script in Markdown, open a session on the screen your audience sees,
and sign in on your phone with the same account: that phone becomes the
remote.

Both devices show **the same words on the same line**, and each lays them out
for its own screen. The phone is not a shrunken copy of the display; it is the
same text, set for a phone.

- **Free and open source.** MIT. No paid tier, no held-back features.
- **Installable.** A progressive web app on iOS, Android, macOS and Windows.
- **Genuinely peer-to-peer.** WebRTC data channel where the network allows it,
  with a realtime relay as the fallback.
- **No accounts to invite.** A room is the set of devices signed in as you.

## Features

|                              |                                                                                                                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Markdown editor**          | Headings, lists, quotes, tables, and cues. A cue (`:: look at camera`) shows on the prompter and is never counted as spoken words.                                                                                                           |
| **Pace in words per minute** | Not pixels per second. 130 wpm is the same delivery speed on a phone and a 27-inch display.                                                                                                                                                  |
| **Tap to jump**              | Tap any line on the remote and the display goes there. Drag to scrub.                                                                                                                                                                        |
| **Mirror and flip**          | For beam-splitter glass and overhead rigs. Toggle from either device, mid-take.                                                                                                                                                              |
| **Three surfaces**           | Night, amber and paper.                                                                                                                                                                                                                      |
| **Keyboard first**           | Space to roll, arrows to step and change pace, `F` fullscreen, `M` mirror. Presenter clickers work without setup.                                                                                                                            |
| **Stays awake**              | The display holds a screen wake lock.                                                                                                                                                                                                        |
| **Resumes**                  | Position is persisted, so a reload lands within a sentence of where you were.                                                                                                                                                                |
| **Folders and sharing**      | Nest scripts into folders, and share a script or a whole folder with an email address as **view only** or **editor**. Access inherits down the tree; view-only can still present. See `/docs/folders-and-sharing`.                           |
| **More than two devices**    | A second display for a co-host, a second remote for a producer. One device drives; the rest follow.                                                                                                                                          |
| **Voice tracking**           | _Experimental, off by default._ The display listens, greys out the words you have said and scrolls to keep up. Uses the browser's own speech recognition: no API key, nothing added to a self-hosted deployment. See `/docs/voice-tracking`. |

## Stack

Next.js (App Router) · TypeScript · tRPC · Tailwind CSS · Drizzle ORM ·
Supabase Postgres · Auth.js (Google, GitHub) · WebRTC · Supabase Realtime

Built on the [T3 stack](https://create.t3.gg).

## Quick start

```bash
git clone https://github.com/biioshq/teleprompt.git
cd teleprompt
npm install
cp .env.example .env
# fill in .env (see below)
npm run db:push
npm run dev
```

### What you need

- Node 20+ and npm
- A [Supabase](https://supabase.com) project (free tier is fine)
- At least one OAuth client: Google, GitHub, or both

### Environment

```dotenv
AUTH_SECRET="…"                   # npx auth secret
AUTH_TRUST_HOST="true"            # required off Vercel

# At least one of these pairs. Both is fine.
AUTH_GOOGLE_ID="…"
AUTH_GOOGLE_SECRET="…"
AUTH_GITHUB_ID="…"
AUTH_GITHUB_SECRET="…"

# A pooler URI, not the direct db.<ref>.supabase.co endpoint - that one is
# IPv6-only and unreachable from Vercel. Username is postgres.<project-ref>.
DATABASE_URL="postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"

NEXT_PUBLIC_SUPABASE_URL="https://REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="…"

# Public origin. Vercel fills this in; set it by hand anywhere else, as a bare
# hostname with no scheme. Unset locally means http://localhost:<PORT>.
# NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL="teleprompt.biios.in"
```

Register the callback URLs with each provider you use:
`http://localhost:3000/api/auth/callback/google` and
`http://localhost:3000/api/auth/callback/github`, plus one per deployed origin.
Google accepts a list of redirect URIs; a GitHub OAuth App holds exactly one, so
production needs its own app.

Sign-ins that share a **verified** email address are linked into one account, so
Google on your laptop and GitHub on your phone still pair. Auth.js's stock GitHub
provider does not check the verified flag; Teleprompt overrides it so an
unverified address can never reach an existing account.

Supabase needs no further configuration. Teleprompt does not use Supabase Auth
or Storage and never reads a table from the browser, so there are no RLS
policies to write.

## Scripts

```bash
npm run dev        # dev server (turbo)
npm run build      # production build
npm run preview    # build, then serve; the service worker only runs here
npm run typecheck  # tsc --noEmit, strict
npm test           # node --test; the permission rules are pinned here
npm run format     # prettier
npm run db:push    # push the Drizzle schema
npm run db:studio  # Drizzle Studio
npm run brand      # regenerate the app icons from scripts/generate-brand-assets.mjs
```

## How the sync works

The obvious approach is to send a scroll offset: device A is at 2,140px, tell
device B to go to 2,140px. That works only while both devices are the same
shape, and they never are.

Teleprompt syncs a position in the **text**. A script is split into an ordered
list of blocks by a pure function of the source string, so every device produces
exactly the same list. A position is then:

```ts
type Anchor = {
  blockIndex: number; // which block is on the reading line
  blockFraction: number; // 0 = its first line, 1 = its last
};
```

Each device resolves that against its own layout. A phone at 19px and a monitor
at 72px land on the same sentence without either knowing anything about the
other's screen.

Devices meet on a Supabase Realtime channel named by a 256-bit room secret, then
negotiate a WebRTC data channel and move the position updates onto it. Sending
falls back per peer: anyone the direct path cannot reach is covered by the
relay, and receivers deduplicate on `(from, seq)`.

Exactly one device drives: the display connected longest, decided from the
presence list so both sides reach the same answer with no round trip. Followers
dead-reckon between the ~10Hz updates and ease toward the prediction, which is
what turns 10Hz data into 60fps motion.

None of this goes through React. The engine writes `transform` straight to the
DOM from a `requestAnimationFrame` loop, so a twenty-minute take runs without a
single re-render.

Full detail: `/docs/architecture` in the running app.

## Repository layout

```
src/
  app/
    (marketing)/           public site, docs, legal
    (app)/                 signed-in surfaces
    prompter/[roomId]/     the display
    remote/[roomId]/       the remote
  components/
    brand/  ui/  marketing/  docs/  app/  pwa/
    prompter/              engine, canvas, session hooks
  server/
    library/
      tree.ts              permission rules and folder maths, no queries
      access.ts            loading, gates, and the library listings
  lib/
    markdown/blocks.ts     deterministic script splitter
    prompter/state.ts      state shape, limits, themes
    realtime/              protocol, link, WebRTC mesh
    voice/                 speech recognition, phrase alignment, word spans
    experiments.ts         per-device flags for unfinished features
  server/
    api/routers/           tRPC: script, room
    auth/                  Auth.js config and guards
    db/                    Drizzle schema and client
scripts/
  generate-brand-assets.mjs
```

## Documentation

The docs ship with the app, at `/docs`:

- Quickstart, connecting devices, install as an app
- Writing scripts, folders and sharing, the remote, display settings, voice tracking, keyboard shortcuts
- Architecture, privacy and data
- Self-hosting, troubleshooting, contributing

## Deployment health

Auth.js reports every internal failure as one generic "misconfigured" message,
so a deployment that cannot reach Postgres, is missing `AUTH_SECRET`, or was
never migrated all look identical in the browser. `/api/health` tells them
apart:

```bash
curl -s https://your-domain.example/api/health
```

```json
{
  "ready": true,
  "database": { "ok": true, "latencyMs": 42, "tables": 7, "canWrite": true },
  "auth": {
    "secret": true,
    "trustHost": true,
    "providers": ["google", "github"]
  },
  "realtime": { "url": true, "anonKey": true },
  "siteUrl": true
}
```

It returns 503 when anything required is missing. Every field is a boolean, a
count, a duration or an error code - no connection string, no secret, no
hostname.

## Self-hosting

It is a standard Next.js App Router application with no edge-only or
platform-specific code, so anywhere that runs Next works. Serve over HTTPS:
WebRTC, the service worker and the wake lock all need a secure context.

## Contributing

See `CONTRIBUTING.md`. Short version: TypeScript is strict, Prettier decides
formatting, everything off the network is validated with Zod, and the frame loop
does not touch React.

Sync changes need testing on two real devices. The WebRTC tie-break and the
presence ordering both depend on there being two device keys, so a single
browser window cannot exercise them.

Wanted: TURN support, importing from Google Docs, timed segments with a
countdown, foot-pedal mapping over the Gamepad API, and a proper accessibility
pass on the prompter surface.

## Security

Report vulnerabilities privately; see `SECURITY.md`.

## Licence

MIT. See `LICENSE`.

---

<div align="center">

Built with &lt;3 by [Biios](https://biios.in) for the Community.

_Building what's next._ A startup consulting studio in Pune, India, working
across strategy, branding, digital products and growth.

</div>
