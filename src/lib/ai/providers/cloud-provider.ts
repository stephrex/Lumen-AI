import type { AssistantProvider, ProviderCapabilities } from "./types";
import { AssistantResponse, type AssistantRequest } from "@/types/assistant";

/* ---------------------------------------------------------------------------
   Cloud provider — posts the turn to our own /api/assistant route, which holds
   the API key server-side (never exposed to the browser). Supports vision.
   Used as a transparent fallback when on-device inference isn't available.
--------------------------------------------------------------------------- */

export class CloudProvider implements AssistantProvider {
  readonly id = "cloud";
  readonly label = "Cloud";
  readonly capabilities: ProviderCapabilities = {
    vision: true,
    onDevice: false,
    processingMode: "cloud",
  };

  async respond(req: AssistantRequest): Promise<AssistantResponse> {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `Cloud request failed (${res.status})`);
    }

    const json = await res.json();
    // Validate on the client too — never trust unvalidated model output.
    return AssistantResponse.parse(json);
  }
}

/** Ask the server whether a cloud key is configured (no secret returned). */
export async function cloudConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/assistant", { method: "GET" });
    if (!res.ok) return false;
    const json = await res.json();
    return !!json?.configured;
  } catch {
    return false;
  }
}
