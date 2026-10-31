/* The explicit application states from section 13 of the blueprint. */
export type LumenState =
  | "IDLE"
  | "OBSERVING"
  | "LISTENING"
  | "THINKING"
  | "SPEAKING"
  | "DEMONSTRATING"
  | "GUIDING"
  | "PAUSED"
  | "ERROR";

export const STATE_META: Record<LumenState, { label: string; tone: string }> = {
  IDLE: { label: "Ready", tone: "#9aa3b8" },
  OBSERVING: { label: "Observing", tone: "#5b8cff" },
  LISTENING: { label: "Listening", tone: "#43d6a0" },
  THINKING: { label: "Thinking", tone: "#9a6bff" },
  SPEAKING: { label: "Speaking", tone: "#5b8cff" },
  DEMONSTRATING: { label: "Showing", tone: "#9a6bff" },
  GUIDING: { label: "Guiding", tone: "#ffb64d" },
  PAUSED: { label: "Paused", tone: "#9aa3b8" },
  ERROR: { label: "Error", tone: "#ff6b6b" },
};
