import { hamming } from "./image-preprocessor";

/* ---------------------------------------------------------------------------
   FrameManager — governs how often we actually call the model:
   - cooldown between analyses
   - in-flight protection (one analysis at a time)
   - duplicate-frame suppression (skip near-identical frames)
   - request cancellation via AbortController
   It does NOT touch the camera preview — capture/preview stay independent.
--------------------------------------------------------------------------- */

export class FrameManager {
  cooldownMs: number;
  dupThreshold: number;
  private lastAt = 0;
  private inFlight = false;
  private lastHash: string | null = null;
  controller: AbortController | null = null;

  constructor(cooldownMs = 2000, dupThreshold = 10) {
    this.cooldownMs = cooldownMs;
    this.dupThreshold = dupThreshold;
  }

  get busy(): boolean {
    return this.inFlight;
  }

  /** True if we're allowed to start a new analysis right now. */
  canRun(now = Date.now()): boolean {
    return !this.inFlight && now - this.lastAt >= this.cooldownMs;
  }

  /** True if this frame is ~identical to the last analysed one. */
  isDuplicate(hash: string): boolean {
    return this.lastHash != null && hamming(this.lastHash, hash) <= this.dupThreshold;
  }

  /** Mark the start of an analysis; aborts any in-flight one and returns a signal. */
  begin(hash?: string): AbortSignal {
    this.cancel();
    this.inFlight = true;
    this.lastAt = Date.now();
    if (hash) this.lastHash = hash;
    this.controller = new AbortController();
    return this.controller.signal;
  }

  end(): void {
    this.inFlight = false;
  }

  cancel(): void {
    try {
      this.controller?.abort();
    } catch {
      /* ignore */
    }
    this.controller = null;
    this.inFlight = false;
  }
}
