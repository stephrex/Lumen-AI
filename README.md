<div align="center">

# 🔦 LUMEN

### Intelligence beside you.

**A camera-first, voice-first AI companion that observes the real world, explains what it sees, and guides you — powered by open-source Gemma, running toward fully on-device.**

[Features](#-features) · [How it works](#-how-it-works) · [Quick start](#-quick-start) · [Architecture](#-architecture) · [Deploy](#-deploy) · [Contributing](./CONTRIBUTING.md)

</div>

---

## What is LUMEN?

Point your phone at something in the real world — a circuit, a laptop, a plant, a machine, a foreign label — **speak naturally**, and LUMEN explains it back to you out loud, draws a diagram, and labels what it sees right on the frame. It feels less like a chatbot with a camera bolted on, and more like having a knowledgeable tutor standing beside you.

The central loop: **SHOW → OBSERVE → UNDERSTAND → EXPLAIN → DEMONSTRATE → GUIDE.**

LUMEN is a mobile-first **Progressive Web App**. The intelligence is **Gemma** (Google's open-weight model); the voice is **Kokoro** (open-source, on-device). The architecture is deliberately built so the whole stack can run **on your device, offline** — no proprietary API required.

## ✨ Features

- 📷 **Camera-first interface** — the live camera *is* the UI, not a button.
- 🗣️ **Voice-first interaction** — talk to it; it talks back with an on-device neural voice.
- 🎯 **Live object labelling** — Gemma detects objects and draws tappable lock-on boxes on the analysed frame; tap one to dive deeper.
- 🧠 **Three modes** — **Explore** (what is this?), **Learn** (how does it work?), **Do/Fix** (safe, step-by-step guidance).
- 🖼️ **Visual explanation engine** — component diagrams, flowcharts, circuits, process flows, equations, and **exploded-views** of devices, rendered from structured JSON (never executed code).
- 👁️ **Ambient mode** — LUMEN glances periodically and speaks up when it notices something new.
- 🌍 **Read & translate** — point at text/signs/labels in any language.
- 🛸 **Spatial-computing HUD** — lock-on brackets, scanning reticle, telemetry, state-reactive glow.
- 🔌 **Open-source, on-device-first** — Gemma + Kokoro, with an optional transparent cloud fallback.
- 📲 **Installable PWA** — works offline for the app shell; model weights stream to the device.

## 🧩 How it works

LUMEN never talks to a model directly. Everything goes through an **`AssistantProvider`** abstraction with three implementations:

| Provider | Role | Open source? | Vision |
|---|---|---|---|
| **On-device Gemma** (MediaPipe / WASM) | primary text inference, offline | ✅ Gemma | text |
| **Cloud** (`/api/assistant`) | vision + heavier reasoning, key stays server-side | ✅ Gemma 4 (served via API) | ✅ |
| **Demo** | labelled, deterministic fallback — never presented as real AI | — | — |

Every answer is validated against a **Zod schema** before the UI trusts it, and the UI always shows *where* the answer was processed (on-device / cloud / demo).

**Voice** is **Kokoro** (Apache-2.0) running in-browser via `@huggingface/transformers`, with the browser voice as an instant fallback while the model loads.

## 🚀 Quick start

```bash
git clone https://github.com/stephrex/Lumen-AI.git
cd Lumen-AI        # (the Next.js app lives here)
npm install
cp .env.example .env.local   # optional — add a key for live vision
npm run dev
```

Open <http://localhost:3000>. The camera and microphone work on `localhost` (a secure context). To test on your **phone**, expose it over HTTPS (e.g. VS Code **Port Forwarding** → set the port **Public**), since phones block camera/mic on plain HTTP.

### Connecting real AI (optional)

LUMEN runs out-of-the-box in clearly-labelled **Demo mode**. To enable real Gemma vision, add a free key from [Google AI Studio](https://aistudio.google.com/apikey) to `.env.local`:

```ini
GEMMA_PROVIDER=gemini
GEMMA_MODEL=gemma-4-26b-a4b-it
GEMINI_API_KEY=your_key_here
```

> The model is **open-source Gemma** — the free API is just a convenient way to reach it. Because the weights are open, you can later self-host with Ollama and point LUMEN at it with a one-line change. See [`.env.example`](./.env.example).

## 🏗️ Architecture

```
src/
  app/
    page.tsx              # the camera workspace + state machine
    api/assistant/route.ts  # cloud inference proxy (key server-side, Zod-validated)
    api/tts/route.ts      # optional neural TTS proxy
  components/             # camera, HUD, orb, captions, chips, visual panel, diagrams
  lib/
    ai/                   # providers (local/cloud/demo), engine, capability-check, model-manager
    speech/kokoro.ts      # on-device open-source voice
  hooks/                  # useCamera, useSpeech
  types/assistant.ts      # the assistant response contract (Zod)
```

Principles: UI, inference, camera, speech and session logic stay separate; the model only ever returns **data**, never executed markup; nothing hazardous is suggested without a warning; camera/mic data is never uploaded without consent.

See [`FEASIBILITY.md`](./FEASIBILITY.md) for the on-device Gemma feasibility study.

## ☁️ Deploy

LUMEN is a standard Next.js app — deploy to **Render**, **Vercel**, or any Node host.

- Set environment variables from [`.env.example`](./.env.example) (never commit `.env.local`).
- Serve over **HTTPS** (required for camera, microphone, and PWA install).
- Model weights are **not** bundled or deployed — they stream to the user's device.

## 🧰 Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · Zod · Lucide · Gemma 4 · Kokoro TTS (`@huggingface/transformers`) · Web Camera / Speech APIs.

## 🙏 Acknowledgements

Built with Google's open **[Gemma](https://ai.google.dev/gemma)** models and the open-source **[Kokoro](https://huggingface.co/hexgrad/Kokoro-82M)** TTS. Thanks to the Google AI Edge and Hugging Face communities.

## 📄 License

[MIT](./LICENSE) — free to use, modify, and build on. See the license for the (minimal) terms.

<div align="center">
<sub>LUMEN should feel like intelligence beside you, not another chatbot on your screen.</sub>
</div>
