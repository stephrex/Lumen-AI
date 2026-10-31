# LUMEN 2.0 — Codebase Audit & Vision Intelligence Upgrade Plan

_Date: 2026-10-31 · Status: **audit only — no 2.0 code written yet, awaiting approval**_

This responds to the LUMEN 2.0 brief (Tasks 1–5). It maps the **current, real** implementation against the proposed architecture and the 43 target features, assesses browser vision technology, and proposes a concrete sequence for **Vision Intelligence v1**. Nothing here has been rewritten — the current app is intact.

---

## Task 1 — Codebase audit (what actually exists)

**Legend:** ✅ implemented & working · 🟡 partial · 🟣 simulated/labelled · ❌ missing

### Experience layer
| Area | Status | Notes |
|---|---|---|
| Camera (start/stop/pause/switch/capture) | ✅ | `hooks/useCamera.ts`; rear-cam preferred, frame capture downscaled to 512px |
| Camera-first full-screen workspace + HUD | ✅ | `app/page.tsx`, `components/Hud.tsx` (brackets, reticle, telemetry, glow) |
| Voice output (TTS) | ✅ | `hooks/useSpeech.ts` — **Kokoro on-device (open-source)** + browser fallback + Fast/Natural toggle |
| Voice input (STT) | 🟡 | Browser Web Speech API — works, but **online & Chrome-only**, not offline |
| Interruptible speech | ✅ | cancel on new turn / mic / "stop" |
| Floating captions + suggestion chips | ✅ | `Captions.tsx`, `SuggestionChips.tsx` |
| PWA (manifest, service worker, installable) | ✅ | `manifest.ts`, `public/sw.js` (app-shell only, never caches camera/mic) |
| State machine (IDLE…SPEAKING…GUIDING) | ✅ | `lib/states.ts` |

### Intelligence / AI layer
| Area | Status | Notes |
|---|---|---|
| Provider abstraction (local/cloud/demo) | ✅ | `lib/ai/providers/*`, `lib/ai/engine.ts` — routes per turn, Zod-validated |
| Response contract (Zod) | ✅ | `types/assistant.ts` — message, speech, observations, **boxes**, visual, task_update, safety, processing_mode |
| Cloud inference (real Gemma) | ✅ | `api/assistant/route.ts` — **Gemma 4 (`gemma-4-26b-a4b-it`)** via Google API, vision + controlled-generation JSON |
| Object detection (bounding boxes) | 🟡 | **Gemma-generated** boxes, rendered as lock-on targets. No specialist detector, no segmentation, no tracking |
| On-device Gemma (text) | 🟡 | `providers/local-gemma-provider.ts` via MediaPipe `tasks-genai` — **coded but untested/opt-in**; WebGPU required |
| Neural TTS (cloud, optional) | ✅ | `api/tts/route.ts` (Gemini) — present but **unused**; Kokoro is the default voice |
| Capability detection / model manager | ✅ | `lib/ai/capability-check.ts`, `lib/ai/model-manager.ts` (streamed download + cache) |

### Visual / teaching layer
| Area | Status | Notes |
|---|---|---|
| Visual explanation engine | ✅ | `components/DiagramRenderer.tsx` — component, flowchart, circuit, process, equation, step, **exploded_view**; JSON→SVG/React, never executes model code |
| Tappable diagram nodes (drill-in) | ✅ | tap a node → follow-up turn on that part |
| Live annotations (boxes + labels) | 🟡 | boxes + labels only; **no arrows, masks, measurement markers** |
| Animated explanations / simulations | ❌ | static diagrams only |

### Reasoning / context / tasks / memory
| Area | Status | Notes |
|---|---|---|
| Scene understanding (structured) | 🟡 | implicit in Gemma output (observations); **no structured scene classification** |
| Scene graph / object relationships | ❌ | history is a flat rolling text array, not a graph |
| Evidence status / hypotheses | 🟡 | `safety` + `confidence` + observations exist; no evidence/hypothesis engine |
| Guided tasks (Do/Fix) | 🟡 | `task_update` schema + steps + **manual confirm** toggle; no planner/verifier/recovery/procedure-memory |
| Photo-verified steps | ❌ | — |
| Persistent memory / library / sessions | ❌ | nothing persisted; in-memory only |
| Ambient "it's alive" mode | ✅ | periodic glance + speak (15s) |
| OCR / translate | ✅ | prompt-based, works on any text |

### Deployment
| Area | Status | Notes |
|---|---|---|
| Render blueprint | ✅ | `render.yaml` |
| Vercel-ready | ✅ | standard Next.js |
| Secrets server-side only | ✅ | keys never `NEXT_PUBLIC`; `.env.local` git-ignored |

**Honest summary:** the *experience*, *provider architecture*, *real Gemma vision*, *visual engine*, and *voice* are solid and real. The **"deep vision intelligence"** (specialist detection, segmentation, tap-to-select, tracking, change detection), **structured context/scene-graph**, **simulation**, and **persistent memory** are the genuine gaps — exactly what 2.0 targets.

---

## Task 2 — Architecture assessment

**Current shape:** `app/page.tsx` is the orchestrator (state machine + turn logic), talking to `lib/ai/engine.ts` (provider routing) and hooks (`useCamera`, `useSpeech`). Clean for v1, but `page.tsx` is becoming a god-component.

**Keep (worth retaining):**
- `AssistantProvider` abstraction + Zod contract — the strongest asset; extend, don't replace.
- Camera & speech hooks, visual renderer (JSON→SVG), HUD, PWA shell.

**Refactor toward 2.0:**
- Extract orchestration out of `page.tsx` into an **Intelligence Orchestration layer**.
- Add an **`engines/`** tree (vision, context, reasoning, visuals, tasks, memory, safety) as the brief proposes.
- Replace the flat history array with a **scene-graph / observation store**.
- Introduce a **`VisionProvider`** interface parallel to `AssistantProvider`, so specialist models slot in without touching UI.

**Bottlenecks / risks in current code:** single-component orchestration; every image turn is an independent API call (no frame pipeline, no dedupe → rate-limit risk); no persistence; tracking/segmentation absent.

---

## Task 3 — Vision technology assessment (browser / mobile)

| Capability | Recommended option | Size / runtime | Browser fit | Notes |
|---|---|---|---|---|
| **Tap-to-select / point-and-ask** | Canvas crop at tap → Gemma (region + context) | ~0 | ✅ trivial | **Cheapest, highest-value win.** No new model |
| **Interactive segmentation** (tap → mask) | MediaPipe **InteractiveSegmenter** | small, WASM/GPU | ✅ good | highlight object without background; same ecosystem as our genai |
| **Generic object detection** | MediaPipe **ObjectDetector** (EfficientDet-Lite) | ~4–7 MB | ✅ real-time | COCO classes only — generic objects, not circuit parts |
| **Open-vocabulary detection** (find "a resistor") | **OWL-ViT / OWLv2** via transformers.js | larger, slower | 🟡 | detect by text query; great for domain parts, heavier |
| **Classification** | MediaPipe ImageClassifier (MobileNet) | small | ✅ | scene/environment hinting |
| **Tracking** | lightweight **IoU/centroid tracker** over periodic detections (JS) | ~0 | ✅ best-effort | no robust DL tracker in-browser; set honest expectations |
| **Change detection** | frame diff / SSIM (canvas) + Gemma compare | ~0 | ✅ | "wire disconnected", "step progressed" |

**Principle (matches the brief): don't make Gemma do everything.** Specialist models detect/segment/track; **Gemma reasons and explains**; a deterministic renderer draws; logic tracks tasks. Caveats from this project: **WebGPU is flaky** (Kokoro fell back to WASM) and **model downloads can be blocked on corporate networks** — every vision model needs a WASM fallback + graceful degradation to the Gemma-only path. Domain objects (circuit components) are **not** in COCO, so open-vocab or Gemma is required for naming, with **uncertainty surfaced**.

---

## Task 4 — Recommended implementation plan

### Vision Intelligence v1 — proposed sequence (each step testable)
1. **Tap-to-select / point-and-ask** — tap anywhere → crop region → Gemma answers about *that* region (reuses frozen frame + scene context). _High value, low effort, no new model._
2. **Frame pipeline** — a real `vision/frame-capture` module: controlled sampling, cooldown, duplicate detection (replaces ad-hoc ambient capture; cuts API/rate-limit pressure).
3. **Scene graph + observation store** (in-memory first) — structured objects, relationships, evidence status; becomes shared context for tutor/visual/task.
4. **Specialist detection behind a `VisionProvider`** — MediaPipe ObjectDetector (generic) and/or OWL-ViT (open-vocab); benchmark vs Gemma boxes; WASM fallback.
5. **Interactive segmentation** — MediaPipe InteractiveSegmenter for tap → mask highlight.
6. **Basic tracking + change detection** — IoU tracker + frame diff.
7. **Persist observations to IndexedDB** — bridges into the Memory phase.

### Mapping to the 2.0 architecture
- `engines/vision/` ← steps 1,2,4,5,6 · `engines/context/` ← step 3 · `storage/indexeddb/` ← step 7 · reasoning/visual/voice engines reuse current modules.

### Risks & dependencies
- WebGPU reliability → always provide WASM fallback + Gemma-only path.
- Model download blocked on some networks → cache + explicit "cloud vision" opt-in (the brief endorses this).
- Latency stacking (detector + segmenter + Gemma) → run specialists on-device, call Gemma sparingly.
- Gemma free-tier **rate limits** for frequent frames → throttle hard; prefer on-device detection to reduce calls.
- Mobile memory with multiple models → load lazily, dispose aggressively.

### Effort (focused build)
M0 audit (this) ✅ · Vision v1 steps 1–3 ≈ a few days · steps 4–6 ≈ 1–2 weeks · step 7 + memory ≈ 1 week · simulation/animation + advanced spatial = later phases.

---

## Task 5 — Awaiting your go-ahead

No 2.0 functionality has been built. **Recommended first slice:** steps 1–3 (tap-to-select + frame pipeline + scene graph) — the backbone the rest builds on, demoable quickly, minimal risk to the working app. Say the word and I'll start there.
