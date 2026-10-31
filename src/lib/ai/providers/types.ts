import type { AssistantRequest, AssistantResponse, ProcessingMode } from "@/types/assistant";

/* ---------------------------------------------------------------------------
   Provider abstraction. The product never talks to a model directly — it talks
   to an AssistantProvider. Local (on-device Gemma), cloud and demo providers
   all implement this, so the inference layer can evolve without touching UI.
--------------------------------------------------------------------------- */

export interface ProviderCapabilities {
  /** Can this provider reason about an image input? */
  vision: boolean;
  /** Does this run entirely on the user's device? */
  onDevice: boolean;
  /** Where processing happens — surfaced in the UI for transparency. */
  processingMode: ProcessingMode;
}

export interface AssistantProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;

  /** Lazy, idempotent. Loads runtimes/models. Reports progress 0..1. */
  init?(onProgress?: (p: number, note: string) => void): Promise<void>;

  /** One conversational turn. Must resolve to schema-valid data.
   *  `signal` allows the caller to cancel an in-flight request. */
  respond(req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResponse>;

  /** Release heavy resources (GPU buffers, model handles). */
  dispose?(): void;
}
