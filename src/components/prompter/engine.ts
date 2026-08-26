"use client";

import { type Anchor } from "~/lib/prompter/state";

/**
 * The scrolling engine.
 *
 * Two decisions shape everything here:
 *
 * 1. The text does not live in a scroll container. It is one tall element that
 *    the engine translates with `transform`, driven from a rAF loop that never
 *    touches React state. A take can run for twenty minutes without a single
 *    re-render, which is what keeps the motion free of jitter.
 *
 * 2. Position is exchanged between devices as a text anchor, never as pixels.
 *    A phone and a laptop have different viewports, type sizes and margins, so
 *    the same `scrollTop` is a different sentence on each. The same anchor is
 *    the same sentence everywhere.
 *
 * The device that owns playback runs in `drive` mode and integrates speed over
 * time. Every other device runs in `follow` mode: it dead-reckons from the last
 * anchor it received and eases toward the prediction, so it moves smoothly at
 * 60fps off updates that arrive ten times a second.
 *
 * A driving device has a second pacer available: a voice target, set from what
 * the reader is actually saying. When one is present it replaces the clock; the
 * script stops being something that moves at a rate and becomes something that
 * moves when they do.
 */

export type EngineMode = "drive" | "follow";

type Measurement = { top: number; height: number };

export type EngineSettings = {
  speedWpm: number;
  readingLine: number;
  /** Spoken words in the whole script: sets the pixels-per-word scale. */
  totalWords: number;
};

export type RemoteSnapshot = {
  anchor: Anchor;
  isPlaying: boolean;
  speedWpm: number;
  /** `performance.now()`-domain time this snapshot was applied locally. */
  receivedAt: number;
};

const EMIT_INTERVAL_MS = 90;
/**
 * How long a received snapshot is allowed to decide the highlight.
 *
 * Comfortably longer than the ~90ms between broadcasts, and far shorter than
 * the ~2s between polls on the degraded path, so the highlight follows the
 * driver when the realtime link is alive and falls back to local geometry when
 * it is not.
 */
const AUTHORITATIVE_HIGHLIGHT_MS = 400;
/** Beyond this much drift, easing looks like a slow drag. Snap instead. */
const SNAP_DISTANCE_FACTOR = 2.5;
const FOLLOW_EASING = 0.18;

/**
 * How hard the text is pulled toward the word being spoken.
 *
 * Gentler than the follower's easing on purpose. A follower is chasing a
 * smooth ramp and can afford to be tight; a voice target arrives in steps, one
 * phrase at a time, and tight easing turns each of those into a visible jerk
 * under someone who is mid-sentence. Loose easing reads as the page keeping
 * up, which is the impression the feature lives or dies on.
 *
 * Quoted per frame at 60Hz, like `FOLLOW_EASING`, and corrected by frame time
 * at use so a 120Hz tablet does not scroll twice as eagerly as a laptop.
 */
const VOICE_EASING = 0.09;

/**
 * Vertical offset of a descendant from an ancestor, by layout rather than by
 * bounding box.
 *
 * Deliberately not `getBoundingClientRect`: the canvas sits under a live
 * `transform`, and for a beam-splitter rig under a flip as well, both of which
 * a client rect reports and layout offsets do not.
 *
 * The chain is walked rather than assumed. `offsetTop` is measured from
 * `offsetParent`, and that is usually the block, but not inside a table, where
 * every engine reports the cell instead. A word in a table would otherwise
 * measure as if it were at the top of the block.
 */
function offsetWithin(node: HTMLElement, ancestor: HTMLElement): number {
  let total = 0;
  let current: HTMLElement | null = node;
  while (current && current !== ancestor) {
    total += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  // The chain left the block without passing through it; a `position: fixed`
  // descendant would do this. One flat offset is a better guess than zero.
  return current === ancestor ? total : node.offsetTop;
}

export class PrompterEngine {
  private viewport: HTMLElement | null = null;
  private content: HTMLElement | null = null;

  private blocks: Measurement[] = [];
  private nodes: HTMLElement[] = [];
  private highlightEnabled = false;
  private activeIndex = -1;
  private paddingTop = 0;
  private contentHeight = 0;
  private viewportHeight = 0;

  /** Distance from the top of the content to the point on the reading line. */
  private position = 0;
  private playing = false;
  private mode: EngineMode = "drive";
  private settings: EngineSettings = {
    speedWpm: 130,
    readingLine: 0.42,
    totalWords: 0,
  };

  private remote: RemoteSnapshot | null = null;

  /* --- Voice tracking ---------------------------------------------------- */

  /** Where the reader's voice says they are. Null when nothing is listening. */
  private voiceTarget: Anchor | null = null;
  private wordsEnabled = false;
  private spokenFollowsPosition = false;
  private wordNodes: HTMLElement[] = [];
  private wordTexts: string[] = [];
  /** Block each word belongs to, and its centre within that block, in pixels. */
  private wordBlocks: number[] = [];
  private wordOffsets: number[] = [];
  /** Absolute distance from the top of the content, for locating a position. */
  private wordTops: number[] = [];
  private spokenWords = 0;
  private cursorWord = -1;

  private frame: number | null = null;
  private lastFrameAt = 0;
  private lastEmitAt = 0;
  private lastEmitted: Anchor | null = null;

  private anchorListeners = new Set<(anchor: Anchor) => void>();
  private endListeners = new Set<() => void>();
  private tickListeners = new Set<(progress: number) => void>();
  private seekListeners = new Set<() => void>();

  /* ---------------------------------------------------------------------- */
  /* Lifecycle                                                              */
  /* ---------------------------------------------------------------------- */

  attach(viewport: HTMLElement, content: HTMLElement) {
    this.viewport = viewport;
    this.content = content;
    this.measure();
    this.start();
  }

  destroy() {
    this.stop();
    this.viewport = null;
    this.content = null;
    this.anchorListeners.clear();
    this.endListeners.clear();
    this.tickListeners.clear();
    this.seekListeners.clear();
  }

  private start() {
    if (this.frame !== null) return;
    this.lastFrameAt = performance.now();
    const loop = (now: number) => {
      this.tick(now);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  private stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  /* ---------------------------------------------------------------------- */
  /* Measurement                                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * Re-reads block geometry. Anything that reflows the text (a font size
   * change, a rotation, a new script) has to go through here, and the anchor is
   * preserved across the change so the reader does not lose their place.
   */
  measure(preserveAnchor = true) {
    if (!this.viewport || !this.content) return;

    const anchor =
      preserveAnchor && this.blocks.length ? this.getAnchor() : null;

    this.viewportHeight = this.viewport.clientHeight;
    this.paddingTop = this.settings.readingLine * this.viewportHeight;

    // The engine owns the leading and trailing space rather than the markup,
    // so that the padding the geometry assumes and the padding the browser
    // laid out can never disagree. They are the same number by construction.
    this.content.style.paddingTop = `${this.paddingTop}px`;
    this.content.style.paddingBottom = `${
      this.viewportHeight - this.paddingTop
    }px`;

    const nodes = [
      ...this.content.querySelectorAll<HTMLElement>("[data-tp-block]"),
    ];
    const next: Measurement[] = [];
    for (const node of nodes) {
      next.push({ top: node.offsetTop, height: node.offsetHeight || 1 });
    }
    // Drop the previous highlight explicitly. React reuses DOM nodes across
    // re-renders, so simply forgetting the index leaves the attribute behind
    // and the next render lights a second line.
    for (const node of nodes) node.removeAttribute("data-tp-active");
    this.blocks = next;
    this.nodes = nodes;
    this.activeIndex = -1;

    const last = next.at(-1);
    this.contentHeight = last ? last.top + last.height : this.paddingTop;

    this.indexWords();

    if (anchor) {
      this.position = this.anchorToPosition(anchor);
    } else {
      this.position = this.clampPosition(this.position);
    }
    this.render();
  }

  get blockCount() {
    return this.blocks.length;
  }

  /* ---------------------------------------------------------------------- */
  /* Coordinates                                                            */
  /* ---------------------------------------------------------------------- */

  private clampPosition(value: number) {
    const min = this.paddingTop;
    const max = Math.max(min, this.contentHeight);
    return Math.min(max, Math.max(min, value));
  }

  private anchorToPosition(anchor: Anchor) {
    const block =
      this.blocks[Math.min(anchor.blockIndex, this.blocks.length - 1)];
    if (!block) return this.paddingTop;
    return this.clampPosition(block.top + anchor.blockFraction * block.height);
  }

  private positionToAnchor(position: number): Anchor {
    if (this.blocks.length === 0) {
      return { blockIndex: 0, blockFraction: 0 };
    }

    // Binary search: a long script is thousands of blocks, and this runs
    // several times a second.
    let low = 0;
    let high = this.blocks.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      const block = this.blocks[mid];
      if (block && block.top <= position) low = mid;
      else high = mid - 1;
    }

    const block = this.blocks[low];
    if (!block) return { blockIndex: 0, blockFraction: 0 };
    const fraction = Math.min(
      1,
      Math.max(0, (position - block.top) / block.height),
    );
    return { blockIndex: low, blockFraction: Number(fraction.toFixed(4)) };
  }

  getAnchor(): Anchor {
    return this.positionToAnchor(this.position);
  }

  /** 0-1 through the whole script, for the progress bar. */
  getProgress(): number {
    const span = this.contentHeight - this.paddingTop;
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, (this.position - this.paddingTop) / span));
  }

  /**
   * Pixels per second for the configured pace. Derived from the measured
   * height of the script and its spoken word count, so 130 wpm means the same
   * delivery speed whether the type is 24px on a phone or 96px on a monitor.
   */
  private pixelsPerSecond(speedWpm: number) {
    const span = this.contentHeight - this.paddingTop;
    const words = this.settings.totalWords;
    if (span <= 0 || words <= 0) return 0;
    return (speedWpm / 60) * (span / words);
  }

  /* ---------------------------------------------------------------------- */
  /* Control                                                                */
  /* ---------------------------------------------------------------------- */

  setSettings(settings: Partial<EngineSettings>) {
    const readingLineChanged =
      settings.readingLine !== undefined &&
      settings.readingLine !== this.settings.readingLine;
    this.settings = { ...this.settings, ...settings };
    if (readingLineChanged) this.measure();
  }

  setMode(mode: EngineMode) {
    this.mode = mode;
    if (mode === "drive") this.remote = null;
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
    this.lastFrameAt = performance.now();
  }

  get isPlaying() {
    return this.playing;
  }

  seek(anchor: Anchor) {
    this.position = this.anchorToPosition(anchor);
    this.render();
    this.emit(true);
    this.announceSeek();
  }

  /** Move whole blocks: the remote's previous / next line buttons. */
  stepBlocks(delta: number) {
    const current = this.getAnchor();
    const target = Math.min(
      Math.max(0, current.blockIndex + delta),
      Math.max(0, this.blocks.length - 1),
    );
    // Stepping backwards from mid-block should land on this block's start
    // first, which is what a reader expects from a "previous" button.
    const fraction = 0;
    if (delta < 0 && current.blockFraction > 0.12) {
      this.seek({ blockIndex: current.blockIndex, blockFraction: fraction });
      return;
    }
    this.seek({ blockIndex: target, blockFraction: fraction });
  }

  /** Fine scrub, in multiples of the viewport height. */
  scrubBy(viewportFractions: number) {
    this.position = this.clampPosition(
      this.position + viewportFractions * this.viewportHeight,
    );
    this.render();
    this.emit(true);
    this.announceSeek();
  }

  /** Direct pixel nudge, used by wheel and drag gestures. */
  nudgePixels(pixels: number) {
    this.position = this.clampPosition(this.position + pixels);
    this.render();
    this.emit(true);
    this.announceSeek();
  }

  restart() {
    this.seek({ blockIndex: 0, blockFraction: 0 });
  }

  /** Apply an authoritative snapshot from the driving device. */
  receive(snapshot: Omit<RemoteSnapshot, "receivedAt">) {
    this.remote = { ...snapshot, receivedAt: performance.now() };
    this.playing = snapshot.isPlaying;
    // The highlight follows the snapshot, so it has to be re-evaluated even
    // when the eased position has not moved far enough to force a frame.
    this.render();
  }

  /* ---------------------------------------------------------------------- */
  /* Voice tracking                                                         */
  /* ---------------------------------------------------------------------- */

  /**
   * Start or stop maintaining the per-word index.
   *
   * Off by default and cheap to leave that way: nothing below runs, and the
   * canvas is not asked to render the extra elements either.
   */
  setWordIndexing(enabled: boolean) {
    if (enabled === this.wordsEnabled) return;
    this.wordsEnabled = enabled;
    if (enabled) {
      this.measure();
      return;
    }
    this.clearVoiceMarks();
    this.wordNodes = [];
    this.wordTexts = [];
    this.wordBlocks = [];
    this.wordOffsets = [];
    this.wordTops = [];
  }

  /** Rebuild the index against whatever the browser has just laid out. */
  private indexWords() {
    this.wordNodes = [];
    this.wordTexts = [];
    this.wordBlocks = [];
    this.wordOffsets = [];
    this.wordTops = [];
    if (!this.wordsEnabled) return;

    for (let block = 0; block < this.nodes.length; block += 1) {
      const node = this.nodes[block];
      const top = this.blocks[block]?.top ?? 0;
      if (!node) continue;
      const spans = node.querySelectorAll<HTMLElement>("[data-tp-word]");
      for (const span of spans) {
        const offset = offsetWithin(span, node) + span.offsetHeight / 2;
        this.wordNodes.push(span);
        this.wordTexts.push(span.textContent ?? "");
        this.wordBlocks.push(block);
        this.wordOffsets.push(offset);
        this.wordTops.push(top + offset);
      }
    }

    // A reflow does not un-say anything, so the marks are re-applied to the
    // nodes the browser has just handed back.
    this.spokenWords = Math.min(this.spokenWords, this.wordNodes.length);
    this.paintSpoken(0, this.wordNodes.length);
    const cursor = this.cursorWord;
    this.cursorWord = -1;
    this.paintCursor(cursor);
  }

  /** The script as rendered, in reading order. */
  getWordTexts(): string[] {
    return this.wordTexts;
  }

  get wordCount() {
    return this.wordNodes.length;
  }

  /** Where a given word sits, in the coordinates every device agrees on. */
  anchorForWord(index: number): Anchor | null {
    if (this.wordNodes.length === 0) return null;
    const clamped = Math.min(Math.max(0, index), this.wordNodes.length - 1);
    const blockIndex = this.wordBlocks[clamped];
    if (blockIndex === undefined) return null;
    const block = this.blocks[blockIndex];
    if (!block) return null;
    const fraction =
      block.height > 0 ? (this.wordOffsets[clamped] ?? 0) / block.height : 0;
    return {
      blockIndex,
      blockFraction: Number(Math.min(1, Math.max(0, fraction)).toFixed(4)),
    };
  }

  /** The word nearest the reading line, used to re-place a lost tracker. */
  wordAtReadingLine(): number {
    if (this.wordTops.length === 0) return 0;
    let low = 0;
    let high = this.wordTops.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if ((this.wordTops[mid] ?? 0) <= this.position) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  /**
   * Dim everything already said and mark the word coming next.
   *
   * Written straight to the DOM for the same reason the active-line highlight
   * is: this changes several times a second and re-rendering a whole script
   * through React to move one attribute would undo the point of the engine.
   * Only the words between the old count and the new one are touched.
   */
  setSpokenWords(count: number) {
    const next = Math.min(Math.max(0, count), this.wordNodes.length);
    if (next !== this.spokenWords) {
      const from = Math.min(next, this.spokenWords);
      const to = Math.max(next, this.spokenWords);
      this.spokenWords = next;
      this.paintSpoken(from, to);
    }
    this.paintCursor(next < this.wordNodes.length ? next : -1);
  }

  private paintSpoken(from: number, to: number) {
    for (let i = from; i < to; i += 1) {
      const node = this.wordNodes[i];
      if (!node) continue;
      if (i < this.spokenWords) node.setAttribute("data-tp-spoken", "true");
      else node.removeAttribute("data-tp-spoken");
    }
  }

  private paintCursor(next: number) {
    if (next === this.cursorWord) return;
    if (this.cursorWord >= 0) {
      this.wordNodes[this.cursorWord]?.removeAttribute("data-tp-cursor");
    }
    if (next >= 0) this.wordNodes[next]?.setAttribute("data-tp-cursor", "true");
    this.cursorWord = next;
  }

  /** Forget who said what. Called when voice tracking stops. */
  clearVoiceMarks() {
    this.setSpokenWords(0);
    this.paintCursor(-1);
    this.voiceTarget = null;
  }

  /**
   * Hand the engine the position the reader's voice is at.
   *
   * The engine eases toward it rather than jumping: a phrase places the reader
   * several words further on at once, and snapping there each time would make
   * the page twitch in time with their speech.
   */
  setVoiceTarget(anchor: Anchor | null) {
    this.voiceTarget = anchor;
  }

  get hasVoiceTarget() {
    return this.voiceTarget !== null;
  }

  /**
   * Keep the spoken marks in step with the scroll position instead of with a
   * microphone.
   *
   * This is how a remote shows the same thing as the display without listening
   * to anything. It only sees the driver's anchor, which is enough: everything
   * above the reading line has been read.
   */
  setSpokenFollowsPosition(enabled: boolean) {
    if (this.spokenFollowsPosition === enabled) return;
    this.spokenFollowsPosition = enabled;
    if (!enabled) this.clearVoiceMarks();
    else this.render();
  }

  /* ---------------------------------------------------------------------- */
  /* Frame loop                                                             */
  /* ---------------------------------------------------------------------- */

  private tick(now: number) {
    const deltaSeconds = Math.min(0.25, (now - this.lastFrameAt) / 1000);
    this.lastFrameAt = now;
    if (!this.content) return;

    const before = this.position;

    if (this.mode === "drive") {
      if (this.voiceTarget) {
        // The reader is the clock. `speedWpm` is not consulted at all while a
        // voice target stands: a pace setting and a person's actual delivery
        // are two different things, and only one of them is in the room.
        const target = this.anchorToPosition(this.voiceTarget);
        const drift = target - this.position;
        if (Math.abs(drift) > this.viewportHeight * SNAP_DISTANCE_FACTOR) {
          this.position = target;
        } else {
          const eased = 1 - (1 - VOICE_EASING) ** (deltaSeconds * 60);
          this.position += drift * eased;
        }
      } else if (this.playing) {
        this.position +=
          this.pixelsPerSecond(this.settings.speedWpm) * deltaSeconds;
        if (this.position >= this.contentHeight) {
          this.position = this.contentHeight;
          this.playing = false;
          for (const listener of this.endListeners) listener();
        }
      }
    } else if (this.remote) {
      // Dead reckoning: where the driver should be *now*, not where it was
      // when the last packet left.
      const elapsed = (now - this.remote.receivedAt) / 1000;
      const predicted = this.clampPosition(
        this.anchorToPosition(this.remote.anchor) +
          (this.remote.isPlaying
            ? this.pixelsPerSecond(this.remote.speedWpm) * elapsed
            : 0),
      );

      const drift = predicted - this.position;
      if (Math.abs(drift) > this.viewportHeight * SNAP_DISTANCE_FACTOR) {
        this.position = predicted;
      } else {
        this.position += drift * FOLLOW_EASING;
      }
    }

    this.position = this.clampPosition(this.position);

    if (this.position !== before) {
      this.render();
      for (const listener of this.tickListeners) listener(this.getProgress());
    }

    if (this.mode === "drive" && now - this.lastEmitAt >= EMIT_INTERVAL_MS) {
      this.emit(false);
    }
  }

  private render() {
    if (!this.content) return;
    const offset = this.paddingTop - this.position;
    this.content.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;

    // A device that is only watching derives the same marks from where the
    // text has got to. `setSpokenWords` is a no-op when nothing changed, so
    // this costs a binary search per frame and nothing else.
    if (this.spokenFollowsPosition && this.wordNodes.length > 0) {
      this.setSpokenWords(this.wordAtReadingLine());
    }

    // The "line you are on" highlight is written straight to the DOM. Routing
    // it through React state would re-render the whole script sixty times a
    // second to change one class name.
    if (!this.highlightEnabled) return;
    const index = this.highlightIndex();
    if (index === this.activeIndex) return;
    this.nodes[this.activeIndex]?.removeAttribute("data-tp-active");
    this.nodes[index]?.setAttribute("data-tp-active", "true");
    this.activeIndex = index;
  }

  /**
   * Which block to light up.
   *
   * A follower must not work this out from its own scroll position. It sits a
   * fraction of a pixel behind the driver, which is invisible while scrolling
   * and decisive at a block boundary: `blockIndex` flips at a hard threshold,
   * so being 0.7px short of the next block's top highlights the previous line
   * for as long as the driver takes to pull clear. The highlight then reads a
   * whole line behind the display, which is exactly the thing a reader would
   * trust and be misled by.
   *
   * So while the driver's word is fresh, take the block index from it and let
   * only the scrolling be eased. If the snapshots have gone stale - the
   * degraded polling path, or a dropped link - fall back to local geometry,
   * which is approximately right rather than frozen.
   */
  private highlightIndex(): number {
    if (this.mode === "follow" && this.remote && this.blocks.length > 0) {
      const age = performance.now() - this.remote.receivedAt;
      if (age <= AUTHORITATIVE_HIGHLIGHT_MS) {
        return Math.min(
          Math.max(0, this.remote.anchor.blockIndex),
          this.blocks.length - 1,
        );
      }
    }
    return this.getAnchor().blockIndex;
  }

  /** Mark the block under the reading line with `data-tp-active`. */
  setHighlight(enabled: boolean) {
    this.highlightEnabled = enabled;
    if (!enabled && this.activeIndex >= 0) {
      this.nodes[this.activeIndex]?.removeAttribute("data-tp-active");
      this.activeIndex = -1;
    }
    this.render();
  }

  /** Index of the block currently under the reading line. */
  getBlockElement(index: number): HTMLElement | null {
    return this.nodes[index] ?? null;
  }

  private emit(force: boolean) {
    if (this.mode !== "drive") return;
    const anchor = this.getAnchor();
    if (
      !force &&
      this.lastEmitted &&
      this.lastEmitted.blockIndex === anchor.blockIndex &&
      Math.abs(this.lastEmitted.blockFraction - anchor.blockFraction) < 0.0015
    ) {
      return;
    }
    this.lastEmitAt = performance.now();
    this.lastEmitted = anchor;
    for (const listener of this.anchorListeners) listener(anchor);
  }

  /* ---------------------------------------------------------------------- */
  /* Subscriptions                                                          */
  /* ---------------------------------------------------------------------- */

  onAnchor(listener: (anchor: Anchor) => void) {
    this.anchorListeners.add(listener);
    return () => {
      this.anchorListeners.delete(listener);
    };
  }

  onEnd(listener: () => void) {
    this.endListeners.add(listener);
    return () => {
      this.endListeners.delete(listener);
    };
  }

  onTick(listener: (progress: number) => void) {
    this.tickListeners.add(listener);
    return () => {
      this.tickListeners.delete(listener);
    };
  }

  /**
   * Someone moved the text by hand: a tap, a drag, a step, a restart.
   *
   * Voice tracking has to hear about this. Its idea of where the reader is came
   * from what they said, and a hand on the script overrides that completely;
   * without this the next phrase would drag the page straight back to where it
   * had been, which reads as the scrub having failed.
   */
  onSeek(listener: () => void) {
    this.seekListeners.add(listener);
    return () => {
      this.seekListeners.delete(listener);
    };
  }

  private announceSeek() {
    for (const listener of this.seekListeners) listener();
  }
}
