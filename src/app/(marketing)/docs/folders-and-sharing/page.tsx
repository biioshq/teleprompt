import { type Metadata } from "next";

import { DocPage, Note } from "~/components/docs/doc-page";
import { docBySlug } from "~/lib/docs/nav";

const SLUG = "folders-and-sharing";
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
        { id: "folders", label: "Folders" },
        { id: "sharing", label: "Sharing" },
        { id: "levels", label: "What each level can do" },
        { id: "inheritance", label: "How access is worked out" },
        { id: "receiving", label: "Things shared with you" },
        { id: "presenting", label: "Presenting somebody else's script" },
        { id: "removing", label: "Taking access away" },
      ]}
    >
      <h2 id="folders">Folders</h2>
      <p>
        A folder holds scripts and other folders, up to eight levels deep. New
        scripts land wherever you made them; anything can be moved later with
        the <strong>Move</strong> action on its card.
      </p>
      <p>
        Deleting a folder deletes the folders inside it and puts the scripts
        back at the top level. It never deletes a script. A folder is an
        organising idea and a script is work, and losing the second because you
        tidied up the first would be indefensible.
      </p>
      <p>
        Folders belong to one account. Somebody you have given editing rights to
        can change the scripts in a shared folder, but cannot rename it, move
        it, delete it, or put their own scripts in it — see{" "}
        <a href="#inheritance">below</a> for why that line is where it is.
      </p>

      <h2 id="sharing">Sharing</h2>
      <p>
        Press <strong>Share</strong> on any script or folder you own, type an
        email address, and choose a level. That is the whole flow. The address
        does not need a Teleprompt account yet: the grant waits for it, and the
        moment somebody signs in with that address the shared item appears in
        their library.
      </p>

      <Note tone="blue" title="No email is sent">
        Teleprompt has no mail provider, deliberately — one more service and one
        more set of credentials to configure before a self-hosted copy works.
        Sharing puts the item in the other person&rsquo;s{" "}
        <strong>Shared with me</strong> list and nothing else happens. Tell them
        it is there.
      </Note>

      <p>
        Only the owner can share. Someone with editing rights can change the
        words; deciding who else gets to read them is a different kind of
        authority, and conflating the two is how a document quietly ends up
        somewhere its author never put it.
      </p>

      <h2 id="levels">What each level can do</h2>
      <table>
        <thead>
          <tr>
            <th>&nbsp;</th>
            <th>View only</th>
            <th>Editor</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Read it</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Start a session and present it</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Duplicate it into their own library</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Edit the words and the title</td>
            <td>No</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Move, rename, delete</td>
            <td>No</td>
            <td>No</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Share it with somebody else</td>
            <td>No</td>
            <td>No</td>
            <td>Yes</td>
          </tr>
        </tbody>
      </table>
      <p>
        View-only lets somebody present. That is the useful reading of it for a
        teleprompter: you are handing them the words to say, not the right to
        change them. If you want somebody to be able to fix a line before they
        go on, make them an editor.
      </p>

      <h2 id="inheritance">How access is worked out</h2>
      <p>Three rules, applied in this order:</p>
      <ol>
        <li>If you own it, you own it. No grant can weaken that.</li>
        <li>
          A grant on the script itself applies, at whatever level it was given.
        </li>
        <li>
          A grant on <em>any</em> folder above it applies too, however far up.
          Sharing a folder shares everything beneath it, including folders
          inside it, forever downward.
        </li>
      </ol>
      <p>
        When more than one grant reaches the same thing, the most generous one
        wins. Somebody given editing rights on one script does not lose them
        because the folder around it was later shared read-only with a group.
      </p>
      <p>
        Access travels down and never sideways or up. Being given a folder does
        not reveal the folder it sits in, or its name — the breadcrumb above a
        shared folder stops where your access does.
      </p>
      <p>
        The rule that a script&rsquo;s folder always belongs to the
        script&rsquo;s owner is what holds this together. It is what lets access
        to a folder imply access to everything listed inside it. Without it you
        could open a folder and be shown the name of a script you cannot open.
      </p>

      <h2 id="receiving">Things shared with you</h2>
      <p>
        Shared folders and scripts appear under <strong>Shared with me</strong>{" "}
        at the top of your library, tagged with who shared them and at what
        level. Only the roots appear there: a script inside a shared folder is
        found by opening the folder, not listed twice.
      </p>
      <p>
        A shared script is not your copy. Editing one as an editor changes the
        original, for everybody. If you want a version of your own, press{" "}
        <strong>Duplicate</strong> — the copy is yours outright and lands at
        your top level.
      </p>

      <h2 id="presenting">Presenting somebody else&rsquo;s script</h2>
      <p>
        Open it and press <strong>Start a session</strong> exactly as you would
        with your own. The room that opens is yours: your join code, your
        devices, your position in the text. The owner&rsquo;s copy is untouched,
        and they will not see your session.
      </p>
      <p>
        As always, both of <em>your</em> devices have to be signed in to your
        own account to pair with each other. Sharing a script does not share a
        room.
      </p>
      <p>
        If the owner edits the script while your session is live, your display
        picks the change up within a few seconds, carrying your reading position
        across — the same behaviour as editing your own script mid-session.
      </p>

      <h2 id="removing">Taking access away</h2>
      <p>
        Open <strong>Share</strong> and remove the address. Access stops
        immediately; there is nothing cached and no link to expire. Anything
        they duplicated is a copy of their own and stays theirs, which is worth
        knowing before you share something you would rather not have copied.
      </p>
      <p>
        On the other side, anything shared with you has a{" "}
        <strong>Remove from my library</strong> action. It gives the grant back
        and takes the item off your dashboard. It does not delete anything — the
        owner keeps their work, and they can share it again.
      </p>
    </DocPage>
  );
}
