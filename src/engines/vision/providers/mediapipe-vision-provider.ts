import type {
  VisionProvider,
  VisionCapabilities,
  VisionDetectionResult,
  VisionSegment,
} from "./vision-provider";
import type { NormPoint } from "../vision-types";
import { MEDIAPIPE_VISION } from "@/config/model";

/* ---------------------------------------------------------------------------
   On-device vision via MediaPipe Tasks Vision (WASM):
   - ObjectDetector (EfficientDet-Lite) → generic object boxes
   - InteractiveSegmenter (magic_touch) → tap-point → object mask
   Everything is best-effort: if a model fails to load, that capability is
   simply disabled and the app falls back to Gemma-only vision.
--------------------------------------------------------------------------- */

// Minimal structural types for the pieces we touch (avoids a hard dep on MP types).
interface MPMask {
  width: number;
  height: number;
  getAsFloat32Array?(): Float32Array;
  getAsUint8Array?(): Uint8Array;
  close(): void;
}
interface Detector {
  detect(image: CanvasImageSource): {
    detections?: Array<{
      boundingBox?: { originX: number; originY: number; width: number; height: number };
      categories?: Array<{ categoryName?: string; score?: number }>;
    }>;
  };
  close(): void;
}
interface Segmenter {
  segment(image: CanvasImageSource, roi: { keypoint: { x: number; y: number } }): {
    confidenceMasks?: MPMask[];
    categoryMask?: MPMask;
  };
  close(): void;
}

export class MediaPipeVisionProvider implements VisionProvider {
  readonly id = "mediapipe";
  readonly label = "On-device MediaPipe";
  readonly capabilities: VisionCapabilities = { detection: true, segmentation: true, onDevice: true };

  private detector: Detector | null = null;
  private segmenter: Segmenter | null = null;
  private initPromise: Promise<void> | null = null;

  ready(): boolean {
    return !!(this.detector || this.segmenter);
  }

  async init(onProgress?: (p: number, note: string) => void): Promise<void> {
    if (this.ready()) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const { FilesetResolver, ObjectDetector, InteractiveSegmenter } = vision;
      onProgress?.(0.1, "Loading vision runtime…");
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_VISION.wasmBase);

      onProgress?.(0.4, "Loading segmenter…");
      try {
        const segOpts = {
          baseOptions: { modelAssetPath: MEDIAPIPE_VISION.interactiveSegmenter },
          outputCategoryMask: true,
          outputConfidenceMasks: true,
        } as unknown as Parameters<typeof InteractiveSegmenter.createFromOptions>[1];
        this.segmenter = (await InteractiveSegmenter.createFromOptions(
          fileset,
          segOpts
        )) as unknown as Segmenter;
      } catch {
        this.segmenter = null;
      }

      onProgress?.(0.75, "Loading detector…");
      try {
        this.detector = (await ObjectDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MEDIAPIPE_VISION.objectDetector },
          runningMode: "IMAGE",
          scoreThreshold: 0.4,
          maxResults: 8,
        })) as unknown as Detector;
      } catch {
        this.detector = null;
      }

      onProgress?.(1, "Ready");
      if (!this.detector && !this.segmenter) throw new Error("No MediaPipe vision model could load");
    })();
    try {
      await this.initPromise;
    } catch (e) {
      this.initPromise = null;
      throw e;
    }
  }

  async detect(image: CanvasImageSource, width: number, height: number): Promise<VisionDetectionResult> {
    if (!this.detector) return { detections: [], source: this.id };
    const res = this.detector.detect(image);
    const detections = (res.detections ?? [])
      .map((d) => {
        const bb = d.boundingBox;
        const c = d.categories?.[0];
        if (!bb) return null;
        return {
          label: c?.categoryName || "object",
          score: c?.score ?? 0,
          box: { x: bb.originX / width, y: bb.originY / height, w: bb.width / width, h: bb.height / height },
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
    return { detections, source: this.id };
  }

  async segmentAtPoint(
    image: CanvasImageSource,
    point: NormPoint,
    _width?: number,
    _height?: number
  ): Promise<VisionSegment | null> {
    void _width;
    void _height;
    if (!this.segmenter) return null;
    const res = this.segmenter.segment(image, { keypoint: { x: point.x, y: point.y } });
    const mask = res.confidenceMasks?.[0] ?? res.categoryMask;
    if (!mask) return null;

    const mw = mask.width;
    const mh = mask.height;
    const conf = mask.getAsFloat32Array?.();
    const cat = mask.getAsUint8Array?.();
    const at = (i: number) => (conf ? conf[i] : cat ? (cat[i] > 0 ? 1 : 0) : 0);
    const canvas = document.createElement("canvas");
    canvas.width = mw;
    canvas.height = mh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      mask.close();
      return null;
    }
    const out = ctx.createImageData(mw, mh);
    let minx = mw, miny = mh, maxx = 0, maxy = 0, has = false;
    for (let i = 0; i < mw * mh; i++) {
      if (at(i) > 0.5) {
        has = true;
        const px = i % mw;
        const py = (i / mw) | 0;
        if (px < minx) minx = px;
        if (py < miny) miny = py;
        if (px > maxx) maxx = px;
        if (py > maxy) maxy = py;
        const o = i * 4;
        out.data[o] = 91; // accent blue
        out.data[o + 1] = 140;
        out.data[o + 2] = 255;
        out.data[o + 3] = 120;
      }
    }
    ctx.putImageData(out, 0, 0);
    mask.close();
    const box = has
      ? { x: minx / mw, y: miny / mh, w: (maxx - minx) / mw, h: (maxy - miny) / mh }
      : undefined;
    return { maskDataUrl: canvas.toDataURL("image/png"), box };
  }

  dispose(): void {
    try {
      this.detector?.close();
      this.segmenter?.close();
    } catch {
      /* ignore */
    }
    this.detector = null;
    this.segmenter = null;
    this.initPromise = null;
  }
}
