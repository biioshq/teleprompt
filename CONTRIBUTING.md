# Contributing to Teleprompt

Thanks for looking. Teleprompt is MIT licensed and maintained by
[Biios](https://biios.in); contributions are accepted under the same licence.

## Getting set up

A contributor setup and a self-hosted setup are the same thing. You need your
own Supabase project and at least one OAuth client (Google or GitHub). There is
no shared development backend.

```bash
git clone https://github.com/biioshq/teleprompt.git
cd teleprompt
npm install
cp .env.example .env      # then fill it in
npm run db:push
npm run dev
```

The full walkthrough is in the running app at `/docs/self-hosting`.

## Conventions

- **TypeScript is strict**, including `noUncheckedIndexedAccess`.
  `npm run typecheck` has to pass.
- **Prettier decides formatting.** Run `npm run format` before committing.
- **Validate at every trust boundary.** Anything arriving from the network (a
  tRPC input, a realtime message, a value read back out of the database) goes
  through Zod before it is used.
- **The frame loop does not touch React.** Anything running per frame belongs in
  `src/components/prompter/engine.ts`, writing to the DOM directly. Routing
  60fps position updates through state re-renders the whole script.
- **Comments explain decisions, not mechanics.** Write down why the anchor is
  not a scroll offset. Do not narrate what the next line does.
- **No emoji in the interface, and no placeholder copy.** Every string that
  ships is a real string.

## Testing a change by hand

There are no automated tests for the sync path, and there is no substitute for
two real devices: the WebRTC tie-break and the presence ordering both depend on
there being two distinct device keys, so one browser window cannot exercise
them.

1. `npm run dev`, open the display on your computer.
2. Reach the dev server from your phone. A tunnel with HTTPS is more
   representative than a LAN IP, because WebRTC and the wake lock both need a
   secure context.
3. Check the connection badge on both devices. **Direct** means the peer path is
   live; **Relay** means you are exercising the fallback. Both need to work.
4. Test a reload mid-session. Persistence is easy to break and easy to miss.
5. If you changed anything about caching or the manifest, test with
   `npm run preview`; the service worker is only registered in production
   builds.

## Areas that would help

- **TURN support**: an optional, configurable TURN server so direct routes are
  possible on networks that block UDP.
- **Import**: Google Docs, plain text, and a paste handler that converts
  formatting to Markdown.
- **Timed segments**: a per-section target duration with a countdown on the
  remote.
- **Foot pedals**: Gamepad API mapping so a pedal can drive play and step.
- **Accessibility**: screen-reader behaviour on the prompter surface deserves a
  proper look.

## Sending a change

1. Open an issue first for anything that touches the sync protocol or the data
   model.
2. Branch, make the change, run `npm run typecheck` and `npm run format`.
3. In the pull request, say what you tested and on which devices. "Two devices,
   same Wi-Fi, direct" is useful. "Works for me" is not.

## Code of conduct

By participating you agree to the terms in `CODE_OF_CONDUCT.md`.
