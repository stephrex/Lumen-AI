# Contributing to LUMEN

Thanks for your interest in making LUMEN better! 🔦 LUMEN is an open-source, camera-first AI companion, and contributions of all kinds are welcome — code, design, docs, bug reports, and ideas.

## Ways to contribute

- 🐛 **Report bugs** — open an issue with steps to reproduce, your device/browser, and a screenshot if it's visual.
- 💡 **Suggest features** — open an issue describing the idea and the "aha" it unlocks.
- 🛠️ **Send a pull request** — fixes, features, docs, or design polish.

## Development setup

```bash
git clone https://github.com/stephrex/Lumen-AI.git
cd Lumen-AI
npm install
cp .env.example .env.local   # optional: add a key for live vision
npm run dev
```

Open <http://localhost:3000>. Camera/mic work on `localhost`. To test on a phone, expose the dev server over HTTPS (VS Code Port Forwarding → Public, or a tunnel).

### Before you push

```bash
npx tsc --noEmit     # types must pass
npm run lint         # lint must pass
npm run build        # production build must succeed
```

There's also a `shoot.js` Playwright script that captures mobile-viewport screenshots — handy for verifying UI changes before you open a PR.

## Project conventions

- **Keep inference behind the provider abstraction.** New models implement `AssistantProvider` in `src/lib/ai/providers/` — don't call a model directly from a component.
- **The model returns data, never code.** All visual output is validated with **Zod** (`src/types/assistant.ts`) and rendered by trusted React components. Never `dangerouslySetInnerHTML` model output.
- **Be honest in the UI.** Simulated/demo output must be clearly labelled and never presented as real model inference. Surface where processing happened (on-device / cloud / demo).
- **Open-source first.** Prefer open, on-device options (Gemma, Kokoro, Whisper). Proprietary services may only be *optional* fallbacks.
- **Safety matters.** For Do/Fix guidance, start with non-invasive checks and warn before anything hazardous.
- Match the surrounding code style; keep dependencies lean; no new infra without a real need.

## Pull request checklist

- [ ] Types, lint, and build pass locally
- [ ] Change is scoped and described clearly
- [ ] UI changes include a before/after screenshot (mobile)
- [ ] No secrets committed (`.env.local` stays local)
- [ ] New inference paths go through `AssistantProvider` and validate with Zod

## Commit messages

Use clear, imperative messages (e.g. `fix: stop caption overlapping chips`). Conventional-commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`) are appreciated but not required.

## Code of conduct

Be kind and constructive. We're here to build something genuinely useful together. Harassment or discrimination of any kind isn't tolerated.

## License

By contributing, you agree that your contributions are licensed under the project's [MIT License](./LICENSE).
