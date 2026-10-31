import type { AssistantProvider, ProviderCapabilities } from "./types";
import { AssistantResponse, type AssistantRequest } from "@/types/assistant";
import { buildSystemPrompt, responseJsonShape } from "@/lib/ai/prompt";
import { fetchModelToObjectUrl } from "@/lib/ai/model-manager";
import { MODEL_CONFIG } from "@/config/model";

/* ---------------------------------------------------------------------------
   On-device Gemma via Google's MediaPipe `tasks-genai` LLM Inference runtime
   (WebGPU). This is the production-ready browser path for local Gemma; the
   LiteRT-LM JS API is still early-preview (see FEASIBILITY.md).

   IMPORTANT: this is TEXT-IN / TEXT-OUT. Browser MediaPipe LLM does not yet
   accept image input for Gemma, so capabilities.vision = false and the app
   routes image turns to the cloud/demo provider instead. We never pretend the
   local model saw the frame.
--------------------------------------------------------------------------- */

// Minimal shape of the MediaPipe pieces we use (avoids a hard type dependency).
interface LlmInferenceLike {
  generateResponse(prompt: string): Promise<string>;
  close?(): void;
}

export class LocalGemmaProvider implements AssistantProvider {
  readonly id = "local-gemma";
  readonly label = "On-device Gemma";
  readonly capabilities: ProviderCapabilities = {
    vision: false,
    onDevice: true,
    processingMode: "local",
  };

  private llm: LlmInferenceLike | null = null;
  private initPromise: Promise<void> | null = null;

  async init(onProgress?: (p: number, note: string) => void): Promise<void> {
    if (this.llm) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (!MODEL_CONFIG.url) {
        throw new Error(
          "No local model URL configured. Set NEXT_PUBLIC_GEMMA_MODEL_URL to a Gemma *-web.task file."
        );
      }

      onProgress?.(0.02, "Loading WebGPU runtime…");
      const genai = await import("@mediapipe/tasks-genai");
      const fileset = await genai.FilesetResolver.forGenAiTasks(MODEL_CONFIG.wasmBase);

      onProgress?.(0.08, "Downloading Gemma weights…");
      const modelUrl = await fetchModelToObjectUrl(MODEL_CONFIG.url, (p) =>
        onProgress?.(0.08 + p * 0.82, `Downloading Gemma weights… ${Math.round(p * 100)}%`)
      );

      onProgress?.(0.92, "Initialising model on GPU…");
      this.llm = (await genai.LlmInference.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelUrl },
        maxTokens: MODEL_CONFIG.maxTokens,
        topK: 40,
        temperature: 0.5,
        randomSeed: 1,
      })) as unknown as LlmInferenceLike;

      onProgress?.(1, "Ready");
    })();

    try {
      await this.initPromise;
    } catch (e) {
      this.initPromise = null;
      throw e;
    }
  }

  async respond(req: AssistantRequest): Promise<AssistantResponse> {
    if (!this.llm) await this.init();
    if (!this.llm) throw new Error("Local model not initialised");

    const system = buildSystemPrompt(req.mode);
    const prompt =
      `${system}\n\n` +
      `The user said: "${req.utterance || "(nothing — greet and offer help)"}"\n` +
      (req.imageDataUrl
        ? "(A camera frame was captured, but on-device text mode cannot see images — answer from the words only and say so if needed.)\n"
        : "") +
      `\nRespond ONLY with JSON in exactly this shape:\n${responseJsonShape}`;

    const raw = await this.llm.generateResponse(prompt);

    // Try to parse structured output; fall back to plain text honestly.
    try {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const body = fenced ? fenced[1] : raw;
      const start = body.indexOf("{");
      const end = body.lastIndexOf("}");
      const obj = JSON.parse(body.slice(start, end + 1));
      return AssistantResponse.parse({ ...obj, processing_mode: "local" });
    } catch {
      const text = raw.trim() || "I'm here.";
      return {
        message: text,
        speech_text: text,
        observations: [],
        boxes: [],
        safety: { level: "none" },
        processing_mode: "local",
      };
    }
  }

  dispose(): void {
    this.llm?.close?.();
    this.llm = null;
    this.initPromise = null;
  }
}
