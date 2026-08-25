import Link from "next/link";

const QUESTIONS = [
  {
    q: "Is it really peer-to-peer?",
    a: "Where the network allows it, yes. The two devices meet on a realtime channel, exchange WebRTC offers over it, and then move the position updates onto a direct data channel between them. The connection badge tells you which path is live: Direct or Relay. Signalling always goes through the relay, because that is what bootstraps the direct path.",
  },
  {
    q: "Do both devices have to be on the same network?",
    a: "No. Same Wi-Fi gives the lowest latency and the best chance of a direct route, but a phone on mobile data and a laptop on hotel Wi-Fi will still pair. They just fall back to the relay if no direct route can be found.",
  },
  {
    q: "Can someone else join my room?",
    a: "Only if they are signed in to your account. Rooms are scoped to an account, and the secret that names the realtime channel is only ever returned to a signed-in device on the owning account. The six-character code is a convenience for you, not a permission grant.",
  },
  {
    q: "Why does the remote show smaller text than the display?",
    a: "Because it is a phone. Both devices show the same words on the same line, but each lays them out for its own screen. That works because devices sync a text anchor rather than a scroll offset.",
  },
  {
    q: "Does it work with beam-splitter glass?",
    a: "Yes. Mirror horizontally for a standard beam-splitter rig, and flip vertically for an overhead setup. Both toggles are available from either device and take effect immediately.",
  },
  {
    q: "What happens if I edit the script while a room is open?",
    a: "The room picks it up on its own, within a few seconds. A room holds a snapshot rather than a live reference, because both devices have to render byte-identical text for positions to mean the same thing on each - but keeping that snapshot current is the app's job, not yours. Your reading position is carried across the change rather than reset.",
  },
  {
    q: "Does voice tracking send my audio anywhere?",
    a: "It uses the speech recognition built into your browser, so where the audio goes is your browser's decision rather than ours. In Chrome and Edge it is streamed to the browser vendor's speech service; Safari does more of it on the device. Either way it never reaches Teleprompt, we receive no audio and store no transcript, and nothing listens until you press the microphone button.",
  },
  {
    q: "How well does voice tracking actually work?",
    a: 'Well enough to present with, though "well enough" is not "always". It matches the last few words you said against the part of the script you were already in, so mishearings, ad-libs and skipped lines are absorbed. It struggles in a loud room, with heavy background music, and with languages that are not written with spaces between words.',
  },
  {
    q: "Is there a paid tier?",
    a: "No. Teleprompt is free and MIT licensed, and the hosted version runs the same code that is in the repository. If you would rather run your own, the self-hosting guide takes about ten minutes.",
  },
  {
    q: "What do you store?",
    a: "Your name, email address and profile image from whichever provider you signed in with, the scripts you write, and the rooms you open. No analytics on what you say, no recordings, no third-party trackers.",
  },
];

export function Faq() {
  return (
    <section className="border-t border-line py-20 lg:py-28">
      <div className="mx-auto max-w-3xl gutter">
        <h2 className="text-[clamp(1.9rem,4vw,2.75rem)]">
          The ones people actually ask.
        </h2>

        <div className="mt-12 border-t border-line">
          {QUESTIONS.map((item) => (
            <details
              key={item.q}
              className="group border-b border-line [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-start gap-5 py-5">
                <span className="flex-1 text-[1.0625rem] font-medium text-ink">
                  {item.q}
                </span>
                <span
                  aria-hidden
                  className="mt-1 shrink-0 font-mono text-lg leading-none text-brand select-none"
                >
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">&minus;</span>
                </span>
              </summary>
              <p className="pr-10 pb-6 text-[0.9375rem] leading-relaxed text-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-8 text-[0.875rem] text-faint">
          Something else?{" "}
          <Link
            href="/docs/troubleshooting"
            className="text-muted underline underline-offset-4"
          >
            Troubleshooting
          </Link>{" "}
          covers the awkward cases, and the{" "}
          <Link
            href="/docs"
            className="text-muted underline underline-offset-4"
          >
            documentation
          </Link>{" "}
          covers everything else.
        </p>
      </div>
    </section>
  );
}
