/* ---------------------------------------------------------------------------
   Device capability detection. We never assume a browser can run local Gemma —
   we probe WebGPU, memory and storage and let the app choose a provider.
--------------------------------------------------------------------------- */

export interface DeviceCapabilities {
  webgpu: boolean;
  /** Rough device memory in GB, when the browser exposes it. */
  deviceMemoryGb: number | null;
  storageQuotaGb: number | null;
  camera: boolean;
  speechRecognition: boolean;
  speechSynthesis: boolean;
  /** Our verdict on whether on-device Gemma is worth attempting here. */
  localInferenceLikely: boolean;
  notes: string[];
}

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

export async function detectCapabilities(): Promise<DeviceCapabilities> {
  const notes: string[] = [];

  // --- WebGPU ---
  let webgpu = false;
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
  if (gpu) {
    try {
      const adapter = await (
        gpu as { requestAdapter(): Promise<unknown> }
      ).requestAdapter();
      webgpu = !!adapter;
      if (!adapter) notes.push("WebGPU present but no adapter granted.");
    } catch {
      notes.push("WebGPU adapter request failed.");
    }
  } else {
    notes.push("WebGPU not available in this browser.");
  }

  // --- Memory ---
  const deviceMemoryGb = (navigator as NavigatorWithMemory).deviceMemory ?? null;
  if (deviceMemoryGb !== null && deviceMemoryGb < 4) {
    notes.push(`Low device memory reported (~${deviceMemoryGb}GB).`);
  }

  // --- Storage ---
  let storageQuotaGb: number | null = null;
  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      if (est.quota) storageQuotaGb = +(est.quota / 1e9).toFixed(1);
    } catch {
      /* ignore */
    }
  }

  // --- Media / speech ---
  const camera = !!navigator.mediaDevices?.getUserMedia;
  const speechRecognition =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const speechSynthesis =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Verdict: WebGPU is the hard requirement for browser Gemma; memory is a hint.
  const localInferenceLikely =
    webgpu && (deviceMemoryGb === null || deviceMemoryGb >= 4);

  return {
    webgpu,
    deviceMemoryGb,
    storageQuotaGb,
    camera,
    speechRecognition,
    speechSynthesis,
    localInferenceLikely,
    notes,
  };
}
