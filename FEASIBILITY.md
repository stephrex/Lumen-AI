# LUMEN — Phase 0: On-device Gemma feasibility report

_Date: 2026-10-31 · Scope: can we run Gemma locally in the browser for LUMEN?_

## TL;DR

- **On-device LLM in the browser is real and shippable today** — but via Google's
  **MediaPipe `tasks-genai` LLM Inference** runtime, **not** LiteRT-LM's JS API,
  which is still an early preview. We built LUMEN against MediaPipe and kept the
  LiteRT-LM option open behind the same provider interface.
- The browser runtime is **text-in / text-out**. It does **not** accept image
  input for Gemma today. So LUMEN's *visual* understanding must come from a
  vision path (cloud now; native/edge vision later), while on-device Gemma
  handles text reasoning offline.
- **WebGPU is mandatory.** No WebGPU → no local model. We detect this and fall
  back transparently to cloud or labelled demo.

## 1. Package & integration

- Package: **`@mediapipe/tasks-genai`** (installed). Loaded via dynamic import so
  it never runs during SSR/build.
- Runtime: `FilesetResolver.forGenAiTasks(wasmBase)` + `LlmInference.createFromOptions(...)`.
- WASM runtime served from CDN by default (`.../@mediapipe/tasks-genai/wasm`),
  overridable via `NEXT_PUBLIC_MEDIAPIPE_WASM` for offline/self-hosting.
- Our integration lives in `src/lib/ai/providers/local-gemma-provider.ts`.

## 2. Browser & WebGPU requirements

- **WebGPU required.** Chrome/Edge 121+ on Android with WebGPU enabled is the
  realistic target. Firefox/Safari support is still uneven on mobile.
- Detected at runtime in `src/lib/ai/capability-check.ts`
  (`navigator.gpu.requestAdapter()`), plus device-memory and storage probes.
- Verdict heuristic: WebGPU present **and** (device memory unknown or ≥4 GB).

## 3. Supported model files

- Browser needs a **GPU-encoded** build. Files named **`*-web.task`** on the
  **LiteRT HuggingFace community** are converted for optimal browser use.
- Good candidates for mobile:
  - **Gemma 3 1B (web)** — small, realistic for phones (~0.5 GB class).
  - Gemma-2 2B — heavier; borderline on 8 GB phones in-browser.
- The large multimodal **Gemma 4 E2B/E4B** (2.5–3.65 GB) from the ChatGPT brief
  are **Android-runtime / LiteRT-LM** oriented and heavy for today's browser JS
  API — treat as a later native-bridge option, not the first browser target.
- Configure the URL via `NEXT_PUBLIC_GEMMA_MODEL_URL` (see `.env.example`).
  **Nothing is bundled into the repo or deployed to the server.**

## 4. Download & storage

- `src/lib/ai/model-manager.ts` streams the model with progress, caches it in the
  **Cache Storage API** (`lumen-models-v1`) for instant, offline re-launch, and
  hands the runtime an object URL. Weights stream host → device directly.
- UX: `DownloadOverlay` shows progress, size and a cancel path; storage quota is
  probed up front. Handles quota-exceeded by continuing without caching.

## 5. Image input: supported?

- **No.** The current browser MediaPipe LLM API is text-only for Gemma. LUMEN
  therefore marks the local provider `vision: false`, and the `AiEngine` routes
  any turn that includes a camera frame to the **cloud** vision provider (or the
  labelled demo), never pretending the local model saw the image.

## 6. What must be tested on a real Android device

1. PWA installs from the Render URL and launches standalone.
2. `navigator.gpu.requestAdapter()` returns an adapter (WebGPU on).
3. A `*-web.task` Gemma model downloads, caches, and initialises on GPU.
4. A text prompt returns a coherent response; measure tokens/sec and peak memory.
5. Generation still works **after disconnecting the network** (offline proof).
6. Low-memory behaviour: does the tab survive, and do we recover gracefully?
7. Capture → cloud vision round-trip latency for the image path.

## 7. Decisions baked into the build

- Provider abstraction (`AssistantProvider`) with **local / cloud / demo**
  implementations; the product never calls a model directly.
- Hybrid routing: on-device text when enabled & offline-capable; cloud for
  vision; demo as an always-available, clearly-labelled fallback.
- `processing_mode` is surfaced in the UI on every answer for transparency.
