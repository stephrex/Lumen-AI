"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus =
  | "idle"
  | "requesting"
  | "live"
  | "paused"
  | "denied"
  | "unavailable"
  | "error";

export interface UseCamera {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  facing: "environment" | "user";
  hasMultipleCameras: boolean;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  switchCamera: () => Promise<void>;
  /** Grab the current frame as a JPEG data URL (downscaled for the model). */
  capture: (maxDim?: number) => string | null;
}

export function useCamera(): UseCamera {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const begin = useCallback(
    async (mode: "environment" | "user") => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        setError("Camera API is not available in this browser.");
        return;
      }
      setStatus("requesting");
      setError(null);
      try {
        stopTracks();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("live");

        // Count cameras (labels may be empty until permission is granted).
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setHasMultipleCameras(devices.filter((d) => d.kind === "videoinput").length > 1);
        } catch {
          /* ignore */
        }
      } catch (e) {
        const name = (e as DOMException)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setError("Camera permission was denied.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setStatus("unavailable");
          setError("No usable camera was found.");
        } else {
          setStatus("error");
          setError((e as Error)?.message || "Could not start the camera.");
        }
      }
    },
    [stopTracks]
  );

  const start = useCallback(() => begin(facing), [begin, facing]);

  const stop = useCallback(() => {
    stopTracks();
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, [stopTracks]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = false));
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = true));
    videoRef.current?.play().catch(() => {});
    setStatus("live");
  }, []);

  const switchCamera = useCallback(async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    await begin(next);
  }, [facing, begin]);

  const capture = useCallback((maxDim = 768): string | null => {
    const video = videoRef.current;
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
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  useEffect(() => stopTracks, [stopTracks]);

  return {
    videoRef,
    status,
    error,
    facing,
    hasMultipleCameras,
    start,
    stop,
    pause,
    resume,
    switchCamera,
    capture,
  };
}
