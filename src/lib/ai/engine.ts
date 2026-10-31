import type { AssistantProvider } from "./providers/types";
import { DemoProvider } from "./providers/demo-provider";
import { CloudProvider, cloudConfigured } from "./providers/cloud-provider";
import { LocalGemmaProvider } from "./providers/local-gemma-provider";
import { detectCapabilities, type DeviceCapabilities } from "./capability-check";
import { isModelCached } from "./model-manager";
import { MODEL_CONFIG } from "@/config/model";
import type { AssistantRequest, AssistantResponse } from "@/types/assistant";

/* ---------------------------------------------------------------------------
   AiEngine — the single place that decides which provider handles a turn.
   Routing (per the blueprint's hybrid architecture):
     • image turn  → needs vision → cloud if configured, else demo
     • text turn   → on-device Gemma if the user enabled it, else cloud, else demo
   The UI reads `status` for transparency (local vs cloud vs demo badge).
--------------------------------------------------------------------------- */

export interface EngineStatus {
  capabilities: DeviceCapabilities | null;
  cloudConfigured: boolean;
  localModelConfigured: boolean;
  localCached: boolean;
  localReady: boolean;
  localEnabled: boolean;
}

export class AiEngine {
  private demo = new DemoProvider();
  private cloud = new CloudProvider();
  private local = new LocalGemmaProvider();

  status: EngineStatus = {
    capabilities: null,
    cloudConfigured: false,
    localModelConfigured: !!MODEL_CONFIG.url,
    localCached: false,
    localReady: false,
    localEnabled: false,
  };

  async prepare(): Promise<EngineStatus> {
    const [capabilities, cloud, localCached] = await Promise.all([
      detectCapabilities(),
      cloudConfigured(),
      isModelCached(MODEL_CONFIG.url),
    ]);
    this.status = {
      ...this.status,
      capabilities,
      cloudConfigured: cloud,
      localCached,
    };
    return this.status;
  }

  /** User opt-in: download + spin up on-device Gemma. */
  async enableLocal(onProgress?: (p: number, note: string) => void): Promise<void> {
    await this.local.init(onProgress);
    this.status.localReady = true;
    this.status.localEnabled = true;
    this.status.localCached = true;
  }

  disableLocal(): void {
    this.local.dispose();
    this.status.localReady = false;
    this.status.localEnabled = false;
  }

  private route(req: AssistantRequest): AssistantProvider {
    // Point-and-Ask and image turns need vision → cloud if available, else demo.
    const hasImage = !!req.imageDataUrl || !!req.selection;

    if (hasImage) {
      if (this.status.cloudConfigured) return this.cloud;
      return this.demo;
    }

    if (this.status.localEnabled && this.status.localReady) return this.local;
    if (this.status.cloudConfigured) return this.cloud;
    return this.demo;
  }

  async respond(
    req: AssistantRequest,
    signal?: AbortSignal
  ): Promise<{ response: AssistantResponse; provider: AssistantProvider }> {
    const provider = this.route(req);
    try {
      const response = await provider.respond(req, signal);
      return { response, provider };
    } catch (err) {
      // A cancelled request is not a failure — propagate so the UI can ignore it.
      if (signal?.aborted || (err as Error)?.name === "AbortError") throw err;
      // Never hard-fail: fall back to the demo provider, labelled honestly.
      if (provider.id !== "demo") {
        const response = await this.demo.respond(req);
        return { response, provider: this.demo };
      }
      throw err;
    }
  }
}
