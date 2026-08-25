import { type Metadata } from "next";
import Link from "next/link";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "writing-scripts";
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
        { id: "blocks", label: "Scripts are blocks" },
        { id: "syntax", label: "Supported syntax" },
        { id: "cues", label: "Cues" },
        { id: "breaks", label: "Breaks and sections" },
        { id: "pace", label: "Words, pace and timing" },
        { id: "craft", label: "Writing for the ear" },
      ]}
    >
      <h2 id="blocks">Scripts are blocks</h2>
      <p>
        Before anything is rendered, a script is split into a flat list of{" "}
        <strong>blocks</strong>: a heading is a block, a paragraph is a block,
        each list item is its own block, a blockquote is a block, a table is a
        block.
      </p>
      <p>
        Blocks are the coordinate system the two devices share. When your phone
        says &ldquo;we are a third of the way through block 42&rdquo;, the
        display resolves that to its own pixel offset. It is also what the
        remote&rsquo;s previous and next buttons step through.
      </p>
      <p>
        Practically, that means{" "}
        <strong>
          how you break up the text changes how the remote behaves
        </strong>
        . A wall of text is one block, so stepping jumps a long way. Four
        bullets are four blocks, so stepping moves one beat at a time.
      </p>

      <h2 id="syntax">Supported syntax</h2>
      <p>
        The editor is Markdown with GitHub extensions. Everything below is
        understood by both the editor preview and the prompter:
      </p>
      <table>
        <thead>
          <tr>
            <th>Syntax</th>
            <th>Becomes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code># Title</code> … <code>###### Six</code>
            </td>
            <td>A heading block, set slightly larger and heavier.</td>
          </tr>
          <tr>
            <td>Plain lines</td>
            <td>One paragraph block per run of non-blank lines.</td>
          </tr>
          <tr>
            <td>
              <code>- item</code> or <code>1. item</code>
            </td>
            <td>One block per item, with the marker set small and dim.</td>
          </tr>
          <tr>
            <td>
              <code>&gt; quote</code>
            </td>
            <td>An indented block with a rule down the left.</td>
          </tr>
          <tr>
            <td>
              <code>**bold**</code>, <code>*italic*</code>, <code>`code`</code>
            </td>
            <td>Inline emphasis, applied inside a block.</td>
          </tr>
          <tr>
            <td>
              <code>[text](url)</code>
            </td>
            <td>
              Underlined text. Links are never clickable on the prompter — a
              stray tap mid-take should not open a browser.
            </td>
          </tr>
          <tr>
            <td>A table</td>
            <td>
              One block, rendered small. You do not read a table aloud line by
              line.
            </td>
          </tr>
          <tr>
            <td>
              <code>```</code> fenced code
            </td>
            <td>One block, monospaced, excluded from the word count.</td>
          </tr>
        </tbody>
      </table>

      <h2 id="cues">Cues</h2>
      <p>
        A line that begins with two colons is a <strong>cue</strong> — a
        direction to yourself rather than something you say:
      </p>
      <pre>
        <code>{`Thank you all for coming.

:: pause — wait for the room to settle

There is one thing I want to leave you with.`}</code>
      </pre>
      <p>Cues are:</p>
      <ul>
        <li>
          set in the accent colour, small and uppercase, so they never read as
          script;
        </li>
        <li>excluded from the word count, and therefore from the timing;</li>
        <li>still blocks, so the remote can step onto one and hold there.</li>
      </ul>
      <p>
        There is a toolbar button for them in the editor, and it wraps whatever
        you have selected.
      </p>

      <Note title="Why two colons">
        HTML comments and blockquotes both already mean something in Markdown,
        and both survive copy-paste into other tools in confusing ways. Two
        colons at the start of a line mean nothing in standard Markdown, so a
        script with cues still reads correctly if it is opened somewhere else.
      </Note>

      <h2 id="breaks">Breaks and sections</h2>
      <p>
        <code>---</code> on its own line becomes a visible break on the
        prompter: a thin rule with the word <em>break</em> in the middle. Use it
        between segments so you can see one coming.
      </p>
      <p>
        Headings do the same job with a name attached. The editor sidebar counts
        them, and they are what you will scan for on the remote when you need to
        jump somewhere.
      </p>

      <h2 id="pace">Words, pace and timing</h2>
      <p>
        The word count excludes cues, code and table markup — it is meant to be
        the number of words you will actually say. The estimate in the sidebar
        uses 130 words per minute, which is a measured speaking pace, not a
        reading pace.
      </p>
      <p>
        During a session, speed is set in words per minute rather than pixels
        per second. Teleprompt converts it using the measured height of your
        script and its word count, so 130 wpm on a phone and 130 wpm on a
        27-inch display are the same delivery speed. Change the type size
        mid-take and the pace does not change with it.
      </p>

      <h2 id="craft">Writing for the ear</h2>
      <p>
        A few things that consistently make a script easier to read out loud:
      </p>
      <ul>
        <li>
          <strong>One idea per block.</strong> Short paragraphs give you natural
          places to breathe and give the remote somewhere useful to step to.
        </li>
        <li>
          <strong>Write contractions.</strong> If you would say
          &ldquo;we&rsquo;ve&rdquo;, write it that way; reading &ldquo;we
          have&rdquo; out loud sounds stiff.
        </li>
        <li>
          <strong>Put numbers in words when they are hard to say.</strong>{" "}
          &ldquo;Twenty-eighteen&rdquo; reads more reliably than
          &ldquo;2018&rdquo; at speed.
        </li>
        <li>
          <strong>Mark the landings.</strong> A cue before your closing line is
          worth more than a rehearsal.
        </li>
      </ul>
      <p>
        When the script is ready,{" "}
        <Link href="/docs/remote-control">the remote</Link> covers what to do
        with it.
      </p>
    </DocPage>
  );
}
