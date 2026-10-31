import type { NormPoint, RegionSelection } from "./vision-types";

/* ---------------------------------------------------------------------------
   Region selection for Point-and-Ask. Critically, this converts SCREEN tap
   coordinates into SOURCE-frame coordinates, accounting for the video's
   object-fit: cover scaling/cropping and front-camera mirroring. We never use
   screen coordinates directly as image coordinates.
--------------------------------------------------------------------------- */

export function screenToFrame(
  video: HTMLVideoElement,
  clientX: number,
  clientY: number,
  mirrored = false
): NormPoint | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const rect = video.getBoundingClientRect();
  const cw = rect.width;
  const ch = rect.height;
  if (!cw || !ch) return null;

  // object-fit: cover → the video is scaled to fill, overflow cropped & centred.
  const scale = Math.max(cw / vw, ch / vh);
  const dispW = vw * scale;
  const dispH = vh * scale;
  const offX = (dispW - cw) / 2;
  const offY = (dispH - ch) / 2;

  let sx = (clientX - rect.left + offX) / scale;
  let sy = (clientY - rect.top + offY) / scale;
  if (mirrored) sx = vw - sx; // front camera is flipped via scaleX(-1)

  const x = Math.min(1, Math.max(0, sx / vw));
  const y = Math.min(1, Math.max(0, sy / vh));
  return { x, y };
}

/** Crop a contextual region around a normalised point and return it as a selection. */
export function cropRegion(
  video: HTMLVideoElement,
  point: NormPoint,
  fraction = 0.42,
  target = 384,
  quality = 0.85
): RegionSelection | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const half = fraction / 2;
  const x0 = Math.max(0, point.x - half);
  const y0 = Math.max(0, point.y - half);
  const x1 = Math.min(1, point.x + half);
  const y1 = Math.min(1, point.y + half);

  const sx = x0 * vw;
  const sy = y0 * vh;
  const sw = (x1 - x0) * vw;
  const sh = (y1 - y0) * vh;
  if (sw < 4 || sh < 4) return null;

  const s = Math.min(1, target / Math.max(sw, sh));
  const cw = Math.max(1, Math.round(sw * s));
  const ch = Math.max(1, Math.round(sh * s));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);

  return {
    point,
    box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    cropDataUrl: canvas.toDataURL("image/jpeg", quality),
  };
}
