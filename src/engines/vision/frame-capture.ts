import type { CapturedFrame } from "./vision-types";
import { frameHash } from "./image-preprocessor";

/* Capture the current video frame as a downscaled JPEG + metadata + hash.
   Independent of inference — the live preview is never blocked by this. */
export function captureFrame(
  video: HTMLVideoElement,
  maxDim = 512,
  quality = 0.8
): CapturedFrame | null {
  if (!video || !video.videoWidth) return null;
  const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", quality),
    width: video.videoWidth,
    height: video.videoHeight,
    timestamp: Date.now(),
    hash: frameHash(video),
  };
}
