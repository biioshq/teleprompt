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
 */

export type EngineMode = "drive" | "follow";

type Measurement = { top: number; height: number };

export type EngineSettings = {
  speedWpm: number;
  readingLine: number;
  /** Spoken words in the whole script — sets the pixels-per-word scale. */
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
/** Beyond this much drift, easing looks like a slow drag. Snap instead. */
const SNAP_DISTANCE_FACTOR = 2.5;
const FOLLOW_EASING = 0.18;

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

  private frame: number | null = null;
  private lastFrameAt = 0;
  private lastEmitAt = 0;
  private lastEmitted: Anchor | null = null;

  private anchorListeners = new Set<(anchor: Anchor) => void>();
  private endListeners = new Set<() => void>();
  private tickListeners = new Set<(progress: number) => void>();

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
   * Re-reads block geometry. Anything that reflows the text — a font size
   * change, a rotation, a new script — has to go through here, and the anchor
   * is preserved across the change so the reader does not lose their place.
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
    this.blocks = next;
    this.nodes = nodes;
    this.activeIndex = -1;

    const last = next.at(-1);
    this.contentHeight = last ? last.top + last.height : this.paddingTop;

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

    // Binary search — a long script is thousands of blocks, and this runs
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
  }

  /** Move whole blocks — the remote's previous / next line buttons. */
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
  }

  /** Direct pixel nudge, used by wheel and drag gestures. */
  nudgePixels(pixels: number) {
    this.position = this.clampPosition(this.position + pixels);
    this.render();
    this.emit(true);
  }

  restart() {
    this.seek({ blockIndex: 0, blockFraction: 0 });
  }

  /** Apply an authoritative snapshot from the driving device. */
  receive(snapshot: Omit<RemoteSnapshot, "receivedAt">) {
    this.remote = { ...snapshot, receivedAt: performance.now() };
    this.playing = snapshot.isPlaying;
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
      if (this.playing) {
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

    // The "line you are on" highlight is written straight to the DOM. Routing
    // it through React state would re-render the whole script sixty times a
    // second to change one class name.
    if (!this.highlightEnabled) return;
    const index = this.getAnchor().blockIndex;
    if (index === this.activeIndex) return;
    this.nodes[this.activeIndex]?.removeAttribute("data-tp-active");
    this.nodes[index]?.setAttribute("data-tp-active", "true");
    this.activeIndex = index;
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
}
