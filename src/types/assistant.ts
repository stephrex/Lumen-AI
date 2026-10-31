import { z } from "zod";

/* ---------------------------------------------------------------------------
   LUMEN assistant response contract (section 10 of the blueprint).
   Every provider — local, cloud or demo — must return data that validates
   against this schema before the UI trusts it.
--------------------------------------------------------------------------- */

export const LumenMode = z.enum(["explore", "learn", "fix"]);
export type LumenMode = z.infer<typeof LumenMode>;

export const ProcessingMode = z.enum(["local", "cloud", "demo"]);
export type ProcessingMode = z.infer<typeof ProcessingMode>;

/* --- Visual explanation primitives ------------------------------------- */

export const DiagramNode = z.object({
  id: z.string(),
  label: z.string(),
  /** 0..1 relative coordinates so the renderer can scale to any viewport */
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  kind: z
    .enum(["component", "input", "output", "process", "decision", "note"])
    .default("component"),
});

export const DiagramEdge = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  /** directional arrow vs. plain connection */
  directed: z.boolean().default(true),
});

export const VisualType = z.enum([
  "component_diagram",
  "flowchart",
  "circuit_diagram",
  "mechanical_diagram",
  "process_flow",
  "equation_visual",
  "step_illustration",
  "exploded_view",
]);
export type VisualType = z.infer<typeof VisualType>;

export const Visual = z.object({
  type: VisualType,
  title: z.string(),
  caption: z.string().optional(),
  nodes: z.array(DiagramNode).max(24).default([]),
  edges: z.array(DiagramEdge).max(40).default([]),
  /** for equation_visual / step_illustration where a node graph isn't ideal */
  steps: z.array(z.string()).max(12).optional(),
  equation: z.string().optional(),
});
export type Visual = z.infer<typeof Visual>;

/* --- Task progress (Do / Fix mode) ------------------------------------- */

export const TaskStep = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(["pending", "active", "done"]).default("pending"),
  requiresConfirmation: z.boolean().default(true),
});

export const TaskUpdate = z.object({
  objective: z.string().optional(),
  steps: z.array(TaskStep).max(16).default([]),
  note: z.string().optional(),
});
export type TaskUpdate = z.infer<typeof TaskUpdate>;

/* --- The full contract -------------------------------------------------- */

/* --- Live object labels (drawn on the analysed frame) ------------------- */

export const DetectedBox = z.object({
  label: z.string(),
  /** Gemma detection convention: normalised 0..1000, [ymin,xmin,ymax,xmax]. */
  ymin: z.number(),
  xmin: z.number(),
  ymax: z.number(),
  xmax: z.number(),
});
export type DetectedBox = z.infer<typeof DetectedBox>;

export const Safety = z.object({
  level: z.enum(["none", "caution", "danger"]).default("none"),
  message: z.string().optional(),
});

export const AssistantResponse = z.object({
  message: z.string(),
  speech_text: z.string(),
  observations: z.array(z.string()).max(8).default([]),
  boxes: z.array(DetectedBox).max(12).default([]),
  confidence: z.number().min(0).max(1).optional(),
  next_action: z.string().optional(),
  visual: Visual.optional(),
  task_update: TaskUpdate.optional(),
  safety: Safety.default({ level: "none" }),
  processing_mode: ProcessingMode,
});
export type AssistantResponse = z.infer<typeof AssistantResponse>;

/* Input the UI hands to a provider for one turn. */
export interface AssistantRequest {
  mode: LumenMode;
  /** The user's spoken/typed utterance for this turn (may be empty). */
  utterance: string;
  /** JPEG data URL of the current frame, when the user requested analysis. */
  imageDataUrl?: string;
  /** Rolling short history for context. */
  history?: { role: "user" | "assistant"; text: string }[];
}
