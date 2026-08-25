import { type Metadata } from "next";

import { DocPage, Note } from "~/components/docs/doc-page";
import { KbdCombo } from "~/components/ui/kbd";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "voice-tracking";
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
        { id: "turning-on", label: "Turning it on" },
        { id: "using", label: "Using it" },
        { id: "how", label: "How it finds your place" },
        { id: "remote", label: "From the remote" },
        { id: "privacy", label: "Where the audio goes" },
        { id: "limits", label: "Where it struggles" },
      ]}
    >
      <Note tone="brand" title="Experimental">
        Voice tracking is off by default, switched on per device, and not yet
        something to rely on for a take you cannot repeat. Everything else in
        Teleprompt works exactly as it does today with it switched off.
      </Note>

      <p>
        Normally the display scrolls at a pace you set, and you read to keep up
        with it. Voice tracking turns that round. The display listens through
        the microphone, works out which words you have already said, greys them
        out, and moves the script so the next thing to say is on the reading
        line. Stop talking and it stops. Skip a paragraph and it skips with you.
      </p>

      <h2 id="turning-on">Turning it on</h2>
      <p>
        On the display, open Settings and find <strong>Experiments</strong> at
        the bottom, then tick <strong>Voice tracking</strong>. A microphone
        button appears next to the transport controls, and the keyboard gets{" "}
        <KbdCombo shortcut={{ keys: ["V"] }} />.
      </p>
      <p>
        The first time you press it the browser asks for permission to use the
        microphone. If you refuse, or have refused before, the readout under the
        script says so and voice tracking switches itself back off — the
        permission has to be changed in the browser&rsquo;s own site settings,
        not here.
      </p>
      <p>
        The switch is stored on the device you set it on, not on your account
        and not in the room. Turning it on for a laptop does not turn it on for
        your phone, which is deliberate: whether a browser can do this at all,
        and whether you want it listening, are properties of the machine in
        front of you.
      </p>

      <h2 id="using">Using it</h2>
      <p>Once it is listening:</p>
      <ul>
        <li>
          Words you have said go dim, in the reading surface&rsquo;s own muted
          tone, so the brightest text on screen is always the sentence you are
          in the middle of.
        </li>
        <li>
          A small orange rule sits under the next word out. It is deliberately
          not a highlight — a block of colour under the word you are about to
          say is precisely where you do not want your eye pulled.
        </li>
        <li>
          A strip under the script shows the last few words the display heard,
          and how many of the script&rsquo;s words have been matched. It is
          there for the moment something goes wrong: it tells you whether it
          misheard you or simply lost the line, which look identical without it.
        </li>
      </ul>
      <p>
        Voice tracking and constant-speed playback are two different things
        moving the same text, so only one of them ever runs. Pressing play, or{" "}
        <KbdCombo shortcut={{ keys: ["Space"] }} />, stops the listening.
        Pressing the microphone stops the clock. Pace in words per minute is
        ignored entirely while it is listening, because your actual delivery is
        the pace.
      </p>
      <p>
        Scrubbing, tapping a line on the remote, stepping and{" "}
        <KbdCombo shortcut={{ keys: ["Home"] }} /> all still work and all win
        outright. Moving the script by hand tells voice tracking to forget where
        it thought you were and pick you up from where you have just put it.
      </p>

      <h2 id="how">How it finds your place</h2>
      <p>
        The obvious approach — remember the last word matched, compare the next
        word heard to the next word written — falls apart on the first line of
        real use. People skip words, add words, say &ldquo;and&rdquo; where the
        page says &ldquo;&amp;&rdquo;, and recognition mishears roughly one word
        in ten. Any of those desynchronises a simple pointer permanently.
      </p>
      <p>
        So instead the last dozen words you said are matched as a{" "}
        <em>phrase</em> against the part of the script you were already in,
        allowing for insertions, deletions and substitutions, and scored. Two or
        three solid word matches anywhere in that phrase are enough to place you
        precisely, and everything else in it can be wrong at no cost.
      </p>
      <p>
        Searching a window rather than the whole script is the other half of it.
        A script says &ldquo;thank you&rdquo; six times; a search over the whole
        document would send you to the wrong one. Looking only a couple of
        sentences either side of where you already were makes a repeated phrase
        unambiguous.
      </p>
      <p>
        If nothing matches for about four seconds, it assumes you are somewhere
        else entirely and searches the whole script instead — at a much higher
        bar for certainty, because moving you to the wrong page is worse than
        not moving you at all. That is what lets you jump to a different section
        mid-take: say a few words from it and it will find you.
      </p>

      <h2 id="remote">From the remote</h2>
      <p>
        Switch the same experiment on for your phone and the remote gets a
        microphone button too. It does not listen — the microphone stays on the
        display, which is the device the person speaking is standing in front
        of. The button asks the display to start and stop.
      </p>
      <p>
        The remote also greys out the spoken words on its mirror, which it can
        do without hearing anything: it already knows where the display has got
        to, and everything above the reading line has been read.
      </p>
      <Note tone="blue" title="If the button does nothing">
        The display has to have the experiment switched on as well. A display
        that does not declines the request, and the remote says so after a
        couple of seconds rather than leaving the button lit.
      </Note>

      <h2 id="privacy">Where the audio goes</h2>
      <p>
        Recognition is the browser&rsquo;s, not ours. Teleprompt asks the
        browser for a transcript and receives words back; there is no API key to
        obtain, no service to sign up for, and nothing added to a self-hosted
        deployment to make this work.
      </p>
      <p>
        What that means in practice depends on the browser.{" "}
        <strong>Chrome and Edge</strong> stream the audio to their
        vendor&rsquo;s speech service and return text. <strong>Safari</strong>{" "}
        does more of the work on the device. In neither case does the audio
        reach a Teleprompt server, and in neither case is a transcript stored —
        the words are matched against your script in the page and discarded.
      </p>
      <p>
        This is the one place Teleprompt sends something you produce anywhere
        other than your own devices, which is why it is behind a switch, why the
        switch says so, and why it is off until you turn it on.{" "}
        <a href="/docs/privacy-and-data">Privacy and data</a> covers everything
        else.
      </p>

      <h2 id="limits">Where it struggles</h2>
      <ul>
        <li>
          <strong>Noisy rooms and background music.</strong> Recognition quality
          is the whole ceiling here, and it degrades before you would expect it
          to.
        </li>
        <li>
          <strong>Languages written without spaces</strong> — Chinese, Japanese,
          Thai. The matching works on whitespace-separated words, so scripts in
          those languages will not track well. The language picker sits under
          the experiment switch and is set per device.
        </li>
        <li>
          <strong>Long silences.</strong> Browsers end a recognition session on
          their own schedule; a new one is started immediately and invisibly,
          but a word said in the gap can be missed.
        </li>
        <li>
          <strong>Scripts that repeat themselves closely.</strong> Two
          near-identical paragraphs a few sentences apart can be confused after
          a re-sync.
        </li>
        <li>
          <strong>Firefox.</strong> It has no built-in speech recognition, so
          the switch is unavailable there and says so.
        </li>
      </ul>
      <p>
        A connection is needed in Chrome and Edge, because their recognition is
        a service rather than something on the device. On a venue network you do
        not trust, set a pace and use the remote.
      </p>
    </DocPage>
  );
}
