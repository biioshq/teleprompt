import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarise } from "./blocks.ts";

/**
 * What a script card is allowed to say.
 *
 * A card shows the script without rendering it, so it is the one surface where
 * a mark that survives is a mark somebody reads. These assertions are the list
 * of marks that must not survive — and, just as importantly, the characters
 * that are not marks at all and must be left alone. Run with `npm test`.
 */

describe("a summary", () => {
  it("keeps the words and drops the marks", () => {
    assert.equal(
      summarise("# Opening\n\nSay it **plainly**, and _mean_ it."),
      "Opening · Say it plainly, and mean it.",
    );
  });

  it("never repeats a cue", () => {
    const summary = summarise(":: breathe, look at the lens\n\nGood evening.");
    assert.equal(summary, "Good evening.");
    assert.ok(!summary.includes("::"));
  });

  it("says nothing at all for a script that is only cues", () => {
    assert.equal(summarise(":: wait for the applause\n:: then begin"), "");
  });

  it("keeps a link's words and loses its target", () => {
    assert.equal(
      summarise("Find us at [the usual place](https://example.com/rooms/42)."),
      "Find us at the usual place.",
    );
  });

  it("leaves hyphens and underscores inside words alone", () => {
    assert.equal(
      summarise("A peer-to-peer teleprompter, driven by `send_anchor`."),
      "A peer-to-peer teleprompter, driven by send_anchor.",
    );
  });

  it("reads a list one beat at a time, without its bullets", () => {
    assert.equal(
      summarise("- Press play\n- Slide the speed\n1. Then land it"),
      "Press play · Slide the speed · Then land it",
    );
  });

  it("reads a table across rather than as a fence of pipes", () => {
    assert.equal(
      summarise("| Cue | Beat |\n| --- | --- |\n| Wave | Two |"),
      "Cue Beat · Wave Two",
    );
  });

  it("skips what is never spoken", () => {
    assert.equal(
      summarise("```js\nconst secret = 1;\n```\n\n---\n\nAnd we are live."),
      "And we are live.",
    );
  });

  it("drops an image and keeps the sentence around it", () => {
    assert.equal(summarise("Look ![the logo](/logo.png) here."), "Look here.");
  });

  it("honours an escaped mark", () => {
    assert.equal(summarise("Costs \\*five\\* pounds."), "Costs *five* pounds.");
  });

  it("collapses a wrapped paragraph into one line", () => {
    assert.equal(
      summarise("One line\nand its continuation.\n\n> Quoted aside"),
      "One line and its continuation. · Quoted aside",
    );
  });

  it("cuts at a word, not mid-word, and says that it cut", () => {
    const summary = summarise("alpha bravo charlie delta echo foxtrot", 20);
    assert.ok(summary.endsWith("…"));
    assert.ok(summary.length <= 21);
    assert.ok(
      "alpha bravo charlie delta echo foxtrot".startsWith(summary.slice(0, -1)),
    );
    assert.ok(!summary.includes("ch…"));
  });

  it("leaves a short script whole, with no trailing ellipsis", () => {
    assert.equal(summarise("Short and done."), "Short and done.");
  });

  it("has nothing to say about an empty script", () => {
    assert.equal(summarise(""), "");
    assert.equal(summarise("\n\n   \n"), "");
  });
});
