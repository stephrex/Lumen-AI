import type { AssistantProvider, ProviderCapabilities } from "./types";
import type { AssistantRequest, AssistantResponse, Visual } from "@/types/assistant";

/* ---------------------------------------------------------------------------
   Demo provider — deterministic, clearly-labelled responses. This is NOT a
   model. It exists so the full UX works before a key or local model is wired.
   Every response it returns is tagged processing_mode: "demo" and the UI
   always shows a "Demo" badge. We never present this as real Gemma output.
--------------------------------------------------------------------------- */

const laptopCharging: Visual = {
  type: "flowchart",
  title: "Why a laptop may not charge",
  caption: "Start with the safest, most common causes first.",
  nodes: [
    { id: "a", label: "Not charging", x: 0.5, y: 0.08, kind: "input" },
    { id: "b", label: "Wall outlet live?", x: 0.5, y: 0.3, kind: "decision" },
    { id: "c", label: "Adapter LED on?", x: 0.5, y: 0.52, kind: "decision" },
    { id: "d", label: "Cable / port seated", x: 0.2, y: 0.74, kind: "process" },
    { id: "e", label: "Try known-good charger", x: 0.8, y: 0.74, kind: "process" },
    { id: "f", label: "Battery / board service", x: 0.5, y: 0.93, kind: "output" },
  ],
  edges: [
    { from: "a", to: "b", directed: true },
    { from: "b", to: "c", label: "yes", directed: true },
    { from: "c", to: "d", label: "yes", directed: true },
    { from: "c", to: "e", label: "no", directed: true },
    { from: "d", to: "f", directed: true },
    { from: "e", to: "f", directed: true },
  ],
};

const circuit: Visual = {
  type: "circuit_diagram",
  title: "Simple LED circuit",
  caption: "Current flows from + through the resistor and LED back to −.",
  nodes: [
    { id: "bat", label: "Battery +", x: 0.12, y: 0.3, kind: "input" },
    { id: "r", label: "Resistor", x: 0.5, y: 0.3, kind: "component" },
    { id: "led", label: "LED", x: 0.85, y: 0.5, kind: "component" },
    { id: "gnd", label: "Battery −", x: 0.12, y: 0.7, kind: "output" },
  ],
  edges: [
    { from: "bat", to: "r", directed: true },
    { from: "r", to: "led", directed: true },
    { from: "led", to: "gnd", directed: true },
  ],
};

const components: Visual = {
  type: "component_diagram",
  title: "What I can point out",
  caption: "Hold steady and tap Analyse for a labelled breakdown.",
  nodes: [
    { id: "1", label: "Main body", x: 0.5, y: 0.5, kind: "component" },
    { id: "2", label: "Interface", x: 0.2, y: 0.25, kind: "input" },
    { id: "3", label: "Output", x: 0.8, y: 0.25, kind: "output" },
    { id: "4", label: "Controls", x: 0.3, y: 0.78, kind: "process" },
    { id: "5", label: "Connector", x: 0.75, y: 0.78, kind: "note" },
  ],
  edges: [
    { from: "2", to: "1", directed: true },
    { from: "1", to: "3", directed: true },
    { from: "4", to: "1", directed: true },
    { from: "1", to: "5", directed: true },
  ],
};

function pick(req: AssistantRequest): AssistantResponse {
  const u = req.utterance.toLowerCase();
  const sawImage = !!req.imageDataUrl;

  if (req.mode === "fix") {
    return {
      message:
        "Let's work through it safely. First, is the wall outlet definitely live, and does the charger's LED light up when plugged in?",
      speech_text:
        "Let's work through it safely. First — is the wall outlet live, and does the charger's light come on?",
      observations: sawImage
        ? ["I can see a laptop and what looks like a charging port on the left edge."]
        : [],
      boxes: [],
      relationships: [],
      confidence: 0.4,
      next_action: "Tell me whether the charger LED is on.",
      visual: laptopCharging,
      task_update: {
        objective: "Diagnose why the laptop isn't charging",
        steps: [
          { id: "s1", text: "Confirm wall outlet is live", status: "active", requiresConfirmation: true },
          { id: "s2", text: "Check charger LED / brick", status: "pending", requiresConfirmation: true },
          { id: "s3", text: "Reseat cable at both ends", status: "pending", requiresConfirmation: true },
          { id: "s4", text: "Test with a known-good charger", status: "pending", requiresConfirmation: true },
        ],
      },
      safety: {
        level: "caution",
        message:
          "Don't open the battery or power supply. If you smell burning or see damage, stop and unplug.",
      },
      processing_mode: "demo",
    };
  }

  if (req.mode === "learn" || u.includes("circuit") || u.includes("current")) {
    return {
      message:
        "Here's the idea: a battery pushes current around the loop. The resistor limits how much flows so the LED isn't damaged.",
      speech_text:
        "A battery pushes current around the loop. The resistor limits the current so the LED is protected.",
      observations: sawImage ? ["There appear to be components on a breadboard."] : [],
      boxes: [],
      relationships: [],
      confidence: 0.5,
      next_action: "Ask 'what happens if I remove the resistor?'",
      visual: circuit,
      safety: { level: "none" },
      processing_mode: "demo",
    };
  }

  // explore (default)
  return {
    message: sawImage
      ? "I'm looking at the frame. Here's how I'd break down what's in front of you — tap a label to go deeper."
      : "Point the camera at something and tap Analyse, or just ask me about what you're seeing.",
    speech_text: sawImage
      ? "Here's how I'd break down what's in front of you."
      : "Point the camera at something and tap Analyse, or ask me a question.",
    observations: sawImage ? ["A single main object centred in frame."] : [],
    boxes: [],
    relationships: [],
    confidence: sawImage ? 0.45 : undefined,
    next_action: "Try: 'explain that' or 'show me how it works'.",
    visual: sawImage ? components : undefined,
    safety: { level: "none" },
    processing_mode: "demo",
  };
}

export class DemoProvider implements AssistantProvider {
  readonly id = "demo";
  readonly label = "Demo";
  readonly capabilities: ProviderCapabilities = {
    vision: false,
    onDevice: true,
    processingMode: "demo",
  };

  async respond(req: AssistantRequest, _signal?: AbortSignal): Promise<AssistantResponse> {
    void _signal;
    // Small latency so state transitions (THINKING → SPEAKING) are visible.
    await new Promise((r) => setTimeout(r, 650));
    return pick(req);
  }
}
