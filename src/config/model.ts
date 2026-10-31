/* ---------------------------------------------------------------------------
   On-device model configuration.

   The model is NOT bundled or deployed to the server — it is downloaded to the
   user's device at runtime. Point NEXT_PUBLIC_GEMMA_MODEL_URL at a browser-
   optimised Gemma build (a `*-web.task` GPU file from the LiteRT HuggingFace
   community, or a URL you host). Leaving it empty keeps local inference off and
   the app uses the cloud/demo provider.

   Example model (requires accepting Gemma's licence on Hugging Face):
   https://huggingface.co/litert-community/Gemma3-1B-IT  →  *-web.task
--------------------------------------------------------------------------- */

export const MODEL_CONFIG = {
  url: process.env.NEXT_PUBLIC_GEMMA_MODEL_URL || "",
  name: process.env.NEXT_PUBLIC_GEMMA_MODEL_NAME || "Gemma 3 1B (web)",
  approxSizeMb: Number(process.env.NEXT_PUBLIC_GEMMA_MODEL_MB || 550),
  // MediaPipe GenAI WASM runtime (served from CDN by default).
  wasmBase:
    process.env.NEXT_PUBLIC_MEDIAPIPE_WASM ||
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm",
  maxTokens: 1024,
} as const;

/* On-device specialist vision models (MediaPipe Tasks Vision). All downloaded
   at runtime from Google's model CDN; everything degrades to Gemma-only vision
   if these can't load (offline / blocked network / unsupported device). */
export const MEDIAPIPE_VISION = {
  wasmBase:
    process.env.NEXT_PUBLIC_MEDIAPIPE_VISION_WASM ||
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
  objectDetector:
    process.env.NEXT_PUBLIC_MP_OBJECT_DETECTOR ||
    "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
  interactiveSegmenter:
    process.env.NEXT_PUBLIC_MP_SEGMENTER ||
    "https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite",
} as const;
