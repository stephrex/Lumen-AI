/* ---------------------------------------------------------------------------
   Vision engine shared types. Coordinates are normalised 0..1 relative to the
   SOURCE video frame (not screen pixels), so they survive responsive scaling.
--------------------------------------------------------------------------- */

export interface CapturedFrame {
  /** JPEG data URL of the (downscaled) full frame. */
  dataUrl: string;
  /** Intrinsic source dimensions of the video. */
  width: number;
  height: number;
  timestamp: number;
  /** Perceptual hash for duplicate-frame detection. */
  hash: string;
}

export interface NormPoint {
  x: number; // 0..1
  y: number; // 0..1
}

export interface NormBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RegionSelection {
  /** The point the user tapped, normalised to the source frame. */
  point: NormPoint;
  /** The contextual crop box around the point, normalised. */
  box: NormBox;
  /** JPEG data URL of the cropped region. */
  cropDataUrl: string;
}
