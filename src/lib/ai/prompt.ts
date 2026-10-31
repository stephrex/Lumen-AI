import type { LumenMode } from "@/types/assistant";

/* The exact JSON shape we ask every model to emit. Kept in sync with the Zod
   schema in types/assistant.ts. Visual/task fields are optional. */
export const responseJsonShape = `{
  "message": string,            // short text shown to the user
  "speech_text": string,        // what to speak aloud (concise, natural)
  "observations": string[],     // what you believe you see (<=8, [] if no image)
  "confidence": number,         // 0..1, optional
  "next_action": string,        // suggested next interaction, optional
  "visual": {                   // OPTIONAL — include only when a diagram helps
    "type": "component_diagram" | "flowchart" | "circuit_diagram" | "mechanical_diagram" | "process_flow" | "equation_visual" | "step_illustration" | "exploded_view",
    "title": string,
    "caption": string,
    "nodes": [{ "id": string, "label": string, "x": number, "y": number, "kind": "component"|"input"|"output"|"process"|"decision"|"note" }],
    "edges": [{ "from": string, "to": string, "label": string, "directed": boolean }],
    "steps": string[],          // optional, for step/equation visuals
    "equation": string          // optional
  },
  "task_update": {              // OPTIONAL — only in fix mode
    "objective": string,
    "steps": [{ "id": string, "text": string, "status": "pending"|"active"|"done", "requiresConfirmation": boolean }],
    "note": string
  },
  "safety": { "level": "none"|"caution"|"danger", "message": string }
}`;

const base = `You are LUMEN, a camera-first, voice-first AI tutor that helps people understand
the physical and technical world around them. You are shown a photo of what the user is
pointing their camera at, plus what they said.

Rules:
- Be concise and clear; speak like a knowledgeable person beside them, not a chatbot.
- Only describe what you can actually see. Never invent details or part numbers.
- Distinguish observed facts from hypotheses. Ask a question when evidence is thin.
- Node coordinates x and y are 0..1 relative to the panel; lay diagrams out so they don't overlap.
- Generate a "visual" only when a diagram genuinely aids understanding.
- For a physical device or assembly (laptop, motor, appliance, gadget), prefer an
  "exploded_view": list its main internal parts as nodes ordered top-to-bottom by
  the y field (0=top). This shows the components pulled apart along an assembly axis.
- Keep speech_text shorter and more natural than message.
- When an image is provided, DETECT the key objects and fill "boxes": for each
  important thing you can see, give a short label and a bounding box as
  [ymin, xmin, ymax, xmax] normalised 0-1000 (Gemma detection format). Label the
  3-7 most relevant objects. If no image, leave boxes empty.`;

const modeNotes: Record<LumenMode, string> = {
  explore:
    "Mode: EXPLORE. Identify and break down what's in frame. Label key parts. A component_diagram is often useful.",
  learn:
    "Mode: LEARN. Teach the underlying concept using what's visible. Use flowchart/circuit/process/equation visuals to explain how it works.",
  fix:
    "Mode: FIX. Guide a practical task safely. Start with non-invasive checks. Provide a task_update with ordered steps; never mark a step done yourself. Warn before anything hazardous. Never instruct opening batteries or working on live mains.",
};

export function buildSystemPrompt(mode: LumenMode): string {
  return `${base}\n\n${modeNotes[mode]}`;
}

/* Gemini/Gemma "controlled generation" schema. Constrains decoding to valid
   JSON so the model emits ONLY the object (no reasoning preamble) — faster and
   reliable. Mirrors AssistantResponse minus processing_mode (set server-side). */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    speech_text: { type: "string" },
    observations: { type: "array", items: { type: "string" } },
    boxes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          ymin: { type: "number" },
          xmin: { type: "number" },
          ymax: { type: "number" },
          xmax: { type: "number" },
        },
        required: ["label", "ymin", "xmin", "ymax", "xmax"],
      },
    },
    confidence: { type: "number" },
    next_action: { type: "string" },
    visual: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "component_diagram",
            "flowchart",
            "circuit_diagram",
            "mechanical_diagram",
            "process_flow",
            "equation_visual",
            "step_illustration",
            "exploded_view",
          ],
        },
        title: { type: "string" },
        caption: { type: "string" },
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
              kind: {
                type: "string",
                enum: ["component", "input", "output", "process", "decision", "note"],
              },
            },
            required: ["id", "label", "x", "y"],
          },
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              label: { type: "string" },
              directed: { type: "boolean" },
            },
            required: ["from", "to"],
          },
        },
        steps: { type: "array", items: { type: "string" } },
        equation: { type: "string" },
      },
      required: ["type", "title"],
    },
    task_update: {
      type: "object",
      properties: {
        objective: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              status: { type: "string", enum: ["pending", "active", "done"] },
              requiresConfirmation: { type: "boolean" },
            },
            required: ["id", "text"],
          },
        },
        note: { type: "string" },
      },
    },
    safety: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["none", "caution", "danger"] },
        message: { type: "string" },
      },
      required: ["level"],
    },
  },
  required: ["message", "speech_text", "safety"],
} as const;
