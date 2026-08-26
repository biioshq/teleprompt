import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STALE_ROOM_MS,
  expiredRatherThanEnded,
  isLive,
  staleCutoff,
} from "./window.ts";

/**
 * The five-minute rule, pinned.
 *
 * The docs make a promise in plain English — a room closes after five quiet
 * minutes — and these are the assertions that keep it true. The stored status
 * alone cannot carry it, because the sweep that writes it only runs when the
 * owning account happens to open a room or load a dashboard. Run with
 * `npm test`.
 */

const ago = (ms: number) => new Date(Date.now() - ms);

describe("the window", () => {
  it("is five minutes", () => {
    assert.equal(STALE_ROOM_MS, 5 * 60 * 1000);
  });

  it("puts the cutoff five minutes back", () => {
    const drift = Math.abs(
      Date.now() - STALE_ROOM_MS - staleCutoff().getTime(),
    );
    assert.ok(drift < 1000, `cutoff drifted by ${drift}ms`);
  });
});

describe("a live room", () => {
  it("is live while something is still checking in", () => {
    assert.equal(isLive({ status: "live", lastActiveAt: ago(0) }), true);
  });

  it("survives a missed heartbeat or three", () => {
    // Devices beat every 45s, so four minutes of silence is a bad network
    // rather than an abandoned room.
    assert.equal(
      isLive({ status: "live", lastActiveAt: ago(4 * 60_000) }),
      true,
    );
  });

  it("is over once the window has run out", () => {
    assert.equal(
      isLive({ status: "live", lastActiveAt: ago(STALE_ROOM_MS + 1000) }),
      false,
    );
  });

  it("is over on the clock alone, before anything writes the status", () => {
    // The whole point: the row still says "live" and it is still not a room
    // anyone can join.
    const quiet = { status: "live", lastActiveAt: ago(STALE_ROOM_MS + 1) };
    assert.equal(quiet.status, "live");
    assert.equal(isLive(quiet), false);
  });
});

describe("an ended room", () => {
  it("stays ended however recently it was touched", () => {
    // Ending a room deliberately has to stick. A late write landing on the row
    // must not reopen it.
    assert.equal(isLive({ status: "ended", lastActiveAt: ago(0) }), false);
  });
});

describe("telling the two endings apart", () => {
  it("reads a room closed while still in use as deliberate", () => {
    // Somebody pressed End room mid-session: the last activity is moments
    // before the ending, not five minutes before it.
    assert.equal(
      expiredRatherThanEnded({ endedAt: ago(0), lastActiveAt: ago(2_000) }),
      false,
    );
  });

  it("reads a room the sweep closed as expired", () => {
    // The sweep only ever ends a room already past its window, so the gap
    // between the last activity and the ending is at least the window itself.
    assert.equal(
      expiredRatherThanEnded({
        endedAt: ago(0),
        lastActiveAt: ago(STALE_ROOM_MS + 60_000),
      }),
      true,
    );
  });

  it("reads a room dead by the clock but not yet swept as expired", () => {
    // No stamp at all: nothing has been round to write one.
    assert.equal(
      expiredRatherThanEnded({
        endedAt: null,
        lastActiveAt: ago(STALE_ROOM_MS + 1_000),
      }),
      true,
    );
  });
});
