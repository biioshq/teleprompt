import Link from "next/link";
import {
  ArrowUpRight,
  Broadcast,
  DeviceMobile,
  Eye,
  FileMd,
  FlipHorizontal,
  Gauge,
  GithubLogo,
  Keyboard,
  Lightning,
  Microphone,
  Monitor,
  PencilSimpleLine,
  Sun,
  Textbox,
  UsersThree,
  Waveform,
} from "@phosphor-icons/react/dist/ssr";

import { Cue } from "~/components/brand/cue";
import { BiiosWordmark } from "~/components/brand/logo";
import { DevicePair } from "~/components/marketing/device-pair";
import { InstallPrompt } from "~/components/pwa/install-prompt";
import { ButtonLink } from "~/components/ui/button";
import { BIIOS, SITE } from "~/lib/site";
import { cn } from "~/lib/utils";

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rule-grid opacity-[0.55]"
        style={{
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 pt-16 gutter pb-40 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24 lg:pb-28">
        <div className="animate-rise">
          <Cue>free forever, open source, installs like an app</Cue>

          <h1 className="mt-6 text-[clamp(2.6rem,6.4vw,4.25rem)] leading-[0.98]">
            Your script,
            <br />
            on <span className="text-brand">both</span> screens.
          </h1>

          <p className="mt-7 max-w-md text-[1.0625rem] leading-relaxed text-ink-soft">
            Turn any second device into the remote for the screen your audience
            sees. Both stay on the same line.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink
              href={signedIn ? "/app" : "/signin"}
              variant="primary"
              size="lg"
            >
              {signedIn ? "Open the app" : "Start free"}
            </ButtonLink>
            <ButtonLink href="/docs/quickstart" variant="outline" size="lg">
              Read the quickstart
            </ButtonLink>
          </div>
        </div>

        <DevicePair className="animate-rise mx-auto w-full max-w-md lg:mx-0" />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    icon: PencilSimpleLine,
    title: "Write it",
    body: "A plain Markdown editor. Headings split the script into sections, bullets give you one beat per line, and a line starting with two colons becomes a cue only you see.",
  },
  {
    icon: Monitor,
    title: "Open a room",
    body: "Press Start a session and this screen becomes the display. You get a six-character code, the only thing you have to carry to the other device.",
  },
  {
    icon: DeviceMobile,
    title: "Drive it",
    body: "Sign in on your phone with the same account, type the code, and it becomes the remote: play, pace, previous line, next line, tap any line to jump there.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-line py-20 lg:py-28">
      <div className="mx-auto max-w-6xl gutter">
        <div className="max-w-2xl">
          <h2 className="text-[clamp(1.9rem,4vw,2.75rem)]">
            Three steps, and the second one is typing six characters.
          </h2>
        </div>

        <ol className="mt-14 grid gap-px md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative border border-line bg-surface p-7 md:-ml-px md:first:ml-0"
            >
              <span className="absolute top-6 right-6 font-poster text-4xl leading-none text-brand opacity-25">
                {String(index + 1).padStart(2, "0")}
              </span>
              <step.icon size={22} weight="bold" className="text-brand" />
              <h3 className="mt-5 text-xl">{step.title}</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The sync                                                                   */
/* -------------------------------------------------------------------------- */

const SYNC_POINTS = [
  {
    icon: Textbox,
    title: "Words, not pixels",
    body: "Devices exchange a text anchor: which block is under the reading line, and how far into it. A phone at 19px and a monitor at 72px resolve that to completely different scroll offsets and still land on the same sentence.",
  },
  {
    icon: Lightning,
    title: "Direct where possible",
    body: "The two devices meet on a realtime channel, then negotiate a WebRTC data channel and move the position updates onto it. On the same Wi-Fi that is single-digit milliseconds, with no server in the path.",
  },
  {
    icon: Broadcast,
    title: "Relay when not",
    body: "Locked-down networks and symmetric NATs happen. When a direct route cannot be established, the relay keeps carrying the same messages and the badge simply reads Relay instead of Direct. Nothing else changes.",
  },
];

export function SyncExplainer() {
  return (
    <section id="sync" className="bg-ink py-20 text-paper lg:py-28">
      <div className="mx-auto max-w-6xl gutter">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-[clamp(1.9rem,4vw,2.75rem)] text-white">
              Two screens, one line.
            </h2>
            <p className="mt-6 max-w-md text-[1rem] leading-relaxed text-white/55">
              Most remote-prompter setups sync a scroll position. That works
              right up until the two devices are different shapes, which they
              always are. Teleprompt syncs the text itself.
            </p>

            <div className="mt-10 rounded-md border border-white/12 bg-white/[0.03] p-5">
              <p className="font-mono text-[0.625rem] tracking-[0.16em] text-white/35 uppercase">
                What goes over the wire
              </p>
              <pre className="mt-3 overflow-x-auto font-mono text-[0.75rem] leading-relaxed text-white/75">
                <code>{`{
  "t": "state",
  "state": {
    "anchor": { "blockIndex": 42, "blockFraction": 0.31 },
    "isPlaying": true,
    "speedWpm": 130
  }
}`}</code>
              </pre>
              <p className="mt-4 text-[0.8125rem] leading-relaxed text-white/45">
                Block 42, a third of the way through. Every device turns that
                into its own pixel offset.
              </p>
            </div>

            <Link
              href="/docs/architecture"
              className="mt-7 inline-flex items-center gap-1.5 text-sm text-white underline decoration-[var(--color-brand)] decoration-2 underline-offset-4"
            >
              How the protocol works
              <ArrowUpRight size={14} weight="bold" className="text-brand" />
            </Link>
          </div>

          <ul className="space-y-px self-start">
            {SYNC_POINTS.map((point) => (
              <li
                key={point.title}
                className="border border-white/10 bg-white/[0.02] p-6"
              >
                <point.icon size={20} weight="bold" className="text-brand" />
                <h3 className="mt-4 text-lg text-white">{point.title}</h3>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-white/50">
                  {point.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Voice tracking                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The demo is a static picture of a real mechanism, not a fake of one: the
 * words before the cursor carry the same dimming the prompter applies, and the
 * marker under the next word is the same rule colour. Nothing here animates:
 * a looping mock of a feature that depends on your microphone would be a
 * promise the page is not in a position to make.
 */
const SPOKEN_DEMO = [
  { text: "Every product starts as a sentence.", said: true },
  { text: "Somebody said it out loud, badly, to three people.", said: true },
  { text: "Our job", said: true },
  { text: "is to keep that sentence intact.", said: false },
];

export function VoiceSection() {
  return (
    <section
      id="voice"
      className="border-y border-line bg-paper-deep py-20 lg:py-28"
    >
      <div className="mx-auto grid max-w-6xl gap-14 gutter lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <h2 className="text-[clamp(1.9rem,4vw,2.75rem)]">
            Or stop setting a pace, and just talk.
          </h2>

          <p className="mt-6 max-w-md text-[1rem] leading-relaxed text-ink-soft">
            Turn on voice tracking and the display listens. Words go grey as you
            say them, and the script moves when you move, not at 130 words a
            minute, not at whatever you guessed before you started. Pause to
            take a question and it waits. Skip a sentence and it skips with you.
          </p>

          <dl className="mt-9 space-y-5">
            {[
              {
                icon: Waveform,
                title: "It finds your place, not your next word",
                body: "The last few words you said are matched against the script around where you already were, so a misheard word, an ad-lib or a skipped line costs nothing. Lose the thread entirely and it searches the whole script to pick you back up.",
              },
              {
                icon: Microphone,
                title: "In the browser, with no account anywhere",
                body: "It uses the speech recognition already built into Chrome, Edge and Safari. There is no key to get and no service to sign up for, including for anyone running their own copy.",
              },
              {
                icon: DeviceMobile,
                title: "The remote still runs the room",
                body: "Start and stop listening from your phone, and watch the words grey out on the mirror as they are read. The microphone stays on the display, where the person speaking is.",
              },
            ].map((row) => (
              <div key={row.title} className="flex gap-4">
                <row.icon
                  size={20}
                  weight="bold"
                  className="mt-0.5 shrink-0 text-brand"
                />
                <div>
                  <dt className="text-[0.9375rem] font-semibold text-ink">
                    {row.title}
                  </dt>
                  <dd className="mt-1.5 text-[0.875rem] leading-relaxed text-muted">
                    {row.body}
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          <Link
            href="/docs/voice-tracking"
            className="mt-8 inline-flex items-center gap-1.5 text-sm text-ink underline decoration-brand decoration-2 underline-offset-4"
          >
            How voice tracking works, and where it does not
            <ArrowUpRight size={14} weight="bold" className="text-brand" />
          </Link>
        </div>

        <div>
          <div className="overflow-hidden rounded-md border border-ink bg-ink shadow-hard-lg">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
              <span className="animate-live inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span className="font-mono text-[0.625rem] tracking-[0.16em] text-white/40 uppercase">
                Listening
              </span>
              <span className="ml-auto font-mono text-[0.6875rem] text-white/35 tabular">
                18/32
              </span>
            </div>

            <p className="px-6 py-8 text-[1.25rem] leading-[1.55] font-medium text-white sm:text-[1.4rem]">
              {SPOKEN_DEMO.map((part, index) => (
                <span
                  key={part.text}
                  className={part.said ? "text-white/30" : "text-white"}
                >
                  {part.text}
                  {index === 2 ? (
                    <span className="mx-[0.15em] inline-block h-[1.1em] w-[2px] translate-y-[0.18em] bg-brand" />
                  ) : (
                    " "
                  )}
                </span>
              ))}
            </p>

            <div className="border-t border-white/10 px-4 py-3">
              <p className="font-mono text-[0.6875rem] leading-relaxed text-white/45">
                heard: &ldquo;somebody said it out loud badly to three people
                our job&rdquo;
              </p>
            </div>
          </div>

          <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted">
            Recognition is your browser&rsquo;s, not ours. In Chrome and Edge
            that means the audio goes to the browser vendor&rsquo;s speech
            service; it never reaches Teleprompt, and nothing is recorded or
            stored. If that is not a trade you want to make, leave it off:
            everything else works exactly as it did.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Features                                                                   */
/* -------------------------------------------------------------------------- */

const FEATURES = [
  {
    icon: FlipHorizontal,
    title: "Mirror and flip",
    body: "For beam-splitter glass and overhead rigs. Toggle from either device, mid-take.",
    span: "sm:col-span-2",
  },
  {
    icon: Gauge,
    title: "Pace in words per minute",
    body: "Not pixels per second. 130 wpm reads the same on a phone and a 27-inch display, because the speed is derived from the measured height of your script.",
    span: "sm:col-span-2 lg:col-span-2",
  },
  {
    icon: Eye,
    title: "Cues you never say",
    body: "Lines beginning with :: show up in orange on the prompter and are excluded from the word count.",
    span: "",
  },
  {
    icon: Sun,
    title: "Night, amber, paper",
    body: "Three reading surfaces. Amber is the classic low-glare prompter look.",
    span: "",
  },
  {
    icon: Keyboard,
    title: "Keyboard first",
    body: "Space to roll, arrows to step and change pace, F for fullscreen, M to mirror.",
    span: "sm:col-span-2",
  },
  {
    icon: UsersThree,
    title: "More than two devices",
    body: "Add a second display for a co-host, or a second remote for a producer. One device drives; the rest follow.",
    span: "sm:col-span-2",
  },
  {
    icon: Monitor,
    title: "Stays awake",
    body: "The display holds a screen wake lock, so it will not dim halfway through your second paragraph.",
    span: "",
  },
  {
    icon: DeviceMobile,
    title: "Picks up where you stopped",
    body: "Position is written back to the database every few seconds. Reload, or hand the remote to someone else, and the line is still there.",
    span: "",
  },
];

export function Features() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-6xl gutter">
        <div className="max-w-2xl">
          <h2 className="text-[clamp(1.9rem,4vw,2.75rem)]">
            The things you only notice when they are missing.
          </h2>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className={cn(
                "rounded-md border border-line bg-surface p-6 transition-shadow hover:shadow-hard-line",
                feature.span,
              )}
            >
              <feature.icon size={20} weight="bold" className="text-brand" />
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                    */
/* -------------------------------------------------------------------------- */

const SAMPLE = `## Opening

Good evening, and thank you for making the time.

:: look at the lens, not the screen

Tonight I want to talk about one small thing.

- Every product starts as a sentence.
- Somebody said it out loud, badly, to three people.
- Our job is to keep that sentence intact.

---

:: slow down, let it land

That is the whole idea. Thank you.`;

export function WritingSection() {
  return (
    <section className="border-y border-line bg-paper-deep py-20 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-14 gutter lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-[clamp(1.9rem,4vw,2.75rem)]">
            Markdown, plus one idea of our own.
          </h2>
          <p className="mt-6 text-[1rem] leading-relaxed text-ink-soft">
            No rich-text toolbar to fight, no formatting that only exists in one
            app. Write the words you are going to say, and let the structure of
            the document become the structure of the read.
          </p>

          <dl className="mt-9 space-y-5">
            {[
              {
                code: "## Section",
                label: "Splits the script into parts you can jump between.",
              },
              {
                code: "- bullet",
                label: "One beat per line, so a remote can step through them.",
              },
              {
                code: ":: cue",
                label:
                  "A note to yourself. Shown in orange, never counted as words.",
              },
              {
                code: "---",
                label: "A hard break, drawn as a rule on the prompter.",
              },
            ].map((row) => (
              <div
                key={row.code}
                className="flex flex-wrap items-baseline gap-3"
              >
                <dt className="rounded-xs border border-line bg-surface px-2 py-1 font-mono text-[0.8125rem] text-ink">
                  {row.code}
                </dt>
                <dd className="flex-1 text-[0.875rem] leading-relaxed text-muted">
                  {row.label}
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href="/docs/writing-scripts"
            className="mt-8 inline-flex items-center gap-1.5 text-sm text-ink underline decoration-brand decoration-2 underline-offset-4"
          >
            <FileMd size={16} weight="bold" />
            Writing scripts
          </Link>
        </div>

        <div className="overflow-hidden rounded-md border border-ink bg-surface shadow-hard-lg">
          <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line-firm" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-firm" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-firm" />
            <span className="ml-2 font-mono text-[0.6875rem] text-faint">
              keynote-open.md
            </span>
          </div>
          <pre className="overflow-x-auto px-5 py-5 font-mono text-[0.8125rem] leading-[1.85] text-ink-soft">
            <code>
              {SAMPLE.split("\n").map((line, index) => (
                <span
                  key={index}
                  className={cn(
                    "block",
                    line.startsWith("::") && "text-brand-deep",
                    line.startsWith("##") && "font-semibold text-ink",
                    line.startsWith("-") && !line.startsWith("---")
                      ? "text-ink-soft"
                      : "",
                    line.startsWith("---") && "text-faint",
                  )}
                >
                  {line || " "}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Install                                                                    */
/* -------------------------------------------------------------------------- */

export function InstallSection() {
  return (
    <section className="py-20 lg:py-24">
      <div className="mx-auto max-w-6xl gutter">
        <div className="grid gap-10 rounded-md border border-ink bg-surface p-8 shadow-hard-lg lg:grid-cols-[1.2fr_0.8fr] lg:p-12">
          <div>
            <h2 className="text-[clamp(1.6rem,3.2vw,2.25rem)]">
              Add it to the home screen and forget it is a website.
            </h2>
            <p className="mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-muted">
              Teleprompt installs like an app on iOS, Android, macOS and
              Windows. Full screen, its own icon, its own window, and a service
              worker that keeps the shell on the device, so a flaky venue
              network cannot leave you staring at a browser error two minutes
              before you go on.
            </p>
            <ul className="mt-6 space-y-2 text-[0.875rem] text-muted">
              <li className="flex items-baseline gap-2.5">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 bg-brand" />
                Launches straight into your scripts
              </li>
              <li className="flex items-baseline gap-2.5">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 bg-brand" />
                A shortcut that opens the remote directly
              </li>
              <li className="flex items-baseline gap-2.5">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 bg-brand" />
                Never caches your scripts&rsquo; API responses, so what you see
                is what is saved
              </li>
            </ul>
          </div>

          <div className="lg:pl-6">
            <InstallPrompt />
            <Link
              href="/docs/install"
              className="mt-4 inline-block text-[0.8125rem] text-muted underline underline-offset-4 transition-colors hover:text-ink"
            >
              Install instructions for every platform
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Open source                                                                */
/* -------------------------------------------------------------------------- */

const STACK = [
  "Next.js",
  "TypeScript",
  "tRPC",
  "Tailwind CSS",
  "Drizzle ORM",
  "Supabase Postgres",
  "Auth.js",
  "WebRTC",
];

export function OpenSourceSection() {
  return (
    <section className="border-t border-line py-20 lg:py-28">
      <div className="mx-auto max-w-6xl gutter">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-[clamp(1.9rem,4vw,2.75rem)]">
              Read it, run it, change it.
            </h2>
            <p className="mt-6 max-w-md text-[1rem] leading-relaxed text-ink-soft">
              The whole thing is {SITE.license} licensed and the repository is
              the real one: same code that runs here. Bring your own Supabase
              project and Google OAuth client and you have your own instance in
              about ten minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={SITE.repo} variant="primary">
                <GithubLogo size={16} weight="bold" />
                View the source
              </ButtonLink>
              <ButtonLink href="/docs/self-hosting" variant="outline">
                Self-hosting guide
              </ButtonLink>
            </div>
          </div>

          <div>
            <ul className="flex flex-wrap gap-2">
              {STACK.map((item) => (
                <li
                  key={item}
                  className="rounded-xs border border-line bg-surface px-2.5 py-1.5 font-mono text-[0.75rem] text-ink-soft"
                >
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-md border border-line bg-surface p-6">
              <h3 className="text-base font-semibold">
                Things worth contributing
              </h3>
              <ul className="mt-4 space-y-2.5 text-[0.875rem] leading-relaxed text-muted">
                <li>
                  A TURN server option, for networks that block direct routes.
                </li>
                <li>Import from Google Docs and plain .txt.</li>
                <li>Per-section countdowns for timed segments.</li>
                <li>A foot-pedal mapping over the Gamepad API.</li>
              </ul>
              <Link
                href="/docs/contributing"
                className="mt-5 inline-block text-[0.875rem] text-ink underline decoration-brand decoration-2 underline-offset-4"
              >
                Contributing guide
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Biios                                                                      */
/* -------------------------------------------------------------------------- */

export function BiiosSection() {
  return (
    <section className="bg-ink py-20 text-paper lg:py-28">
      <div className="mx-auto max-w-6xl gutter">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <Cue tone="ink">the studio behind it</Cue>
            <a
              href={BIIOS.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group mt-5 inline-flex items-baseline gap-2"
            >
              <BiiosWordmark className="text-4xl text-white" />
              <ArrowUpRight
                size={20}
                weight="bold"
                className="text-brand transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
              />
            </a>
            <p className="mt-5 text-[1.25rem] leading-snug text-white/80">
              {BIIOS.tagline}
            </p>
            <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-white/50">
              {BIIOS.mission} Biios is a startup consulting studio in{" "}
              {BIIOS.city}, working end to end across strategy, branding,
              digital products and growth.
            </p>

            <dl className="mt-10 grid max-w-md grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4 lg:grid-cols-2">
              {BIIOS.stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="font-poster text-3xl leading-none text-brand">
                    {stat.value}
                  </dt>
                  <dd className="mt-2 font-mono text-[0.625rem] tracking-[0.12em] text-white/40 uppercase">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <ul className="space-y-px">
              {BIIOS.disciplines.map((discipline) => (
                <li
                  key={discipline.name}
                  className="flex items-baseline gap-5 border border-white/10 bg-white/[0.02] px-6 py-5"
                >
                  <span className="w-24 shrink-0 font-poster text-xl text-brand">
                    {discipline.name}
                  </span>
                  <span className="text-[0.9375rem] text-white/55">
                    {discipline.detail}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-md border border-white/12 bg-white/[0.03] p-6">
              <p className="text-[0.9375rem] leading-relaxed text-white/70">
                Teleprompt started as a tool we needed for founder videos and
                launch films, and there was no reason to keep it to ourselves.
                It is given to the community as it is used internally: same
                code, no held-back paid tier.
              </p>
              <p className="mt-4 font-mono text-[0.6875rem] tracking-[0.14em] text-white/40">
                Built with {"<3"} by {BIIOS.name} for the Community.
              </p>
              <a
                href={BIIOS.contact}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-5 inline-flex items-center gap-1.5 text-sm text-white underline decoration-[var(--color-brand)] decoration-2 underline-offset-4"
              >
                Start a project with Biios
                <ArrowUpRight size={14} weight="bold" className="text-brand" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA                                                                  */
/* -------------------------------------------------------------------------- */

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-3xl gutter text-center">
        <h2 className="text-[clamp(2rem,5vw,3.25rem)] leading-[1.02]">
          Put the words where you are looking.
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-muted">
          Sign in with Google or GitHub on the screen you want to read from,
          then on the phone you want to hold. That is the entire setup.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink
            href={signedIn ? "/app" : "/signin"}
            variant="brand"
            size="lg"
          >
            {signedIn ? "Open the app" : "Start free"}
          </ButtonLink>
          <ButtonLink href="/docs" variant="outline" size="lg">
            Browse the docs
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
