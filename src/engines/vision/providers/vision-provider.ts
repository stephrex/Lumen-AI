import type { NormBox, NormPoint } from "../vision-types";

/* ---------------------------------------------------------------------------
   VisionProvider — the abstraction for specialist on-device vision models
   (detection, segmentation). Parallels AssistantProvider: the product talks to
   this interface, not a specific model, so detectors/segmenters can evolve or
   be swapped (MediaPipe today, OWL-ViT/SAM later) without touching the UI.
   Gemma remains the high-level reasoner; these feed it structured observations.
--------------------------------------------------------------------------- */

export interface VisionDetection {
  label: string;
  score: number;
  box: NormBox; // normalised 0..1 of the source frame
}

export interface VisionDetectionResult {
  detections: VisionDetection[];
  source: string;
}

export interface VisionSegment {
  /** PNG data URL: coloured where the selected object is, transparent elsewhere. */
  maskDataUrl: string;
  /** Tight normalised bounding box of the masked region. */
  box?: NormBox;
}

export interface VisionCapabilities {
  detection: boolean;
  segmentation: boolean;
  onDevice: boolean;
}

export interface VisionProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities: VisionCapabilities;

  init(onProgress?: (p: number, note: string) => void): Promise<void>;
  ready(): boolean;

  detect?(image: CanvasImageSource, width: number, height: number): Promise<VisionDetectionResult>;
  segmentAtPoint?(
    image: CanvasImageSource,
    point: NormPoint,
    width: number,
    height: number
  ): Promise<VisionSegment | null>;

  dispose?(): void;
}
