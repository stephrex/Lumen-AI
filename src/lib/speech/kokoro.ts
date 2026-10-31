"use client";

/* ---------------------------------------------------------------------------
   Kokoro — an Apache-2.0, open-source neural TTS that runs ENTIRELY in the
   browser (WebGPU, falling back to WASM) via @huggingface/transformers. No
   proprietary API: the voice is on-device, matching LUMEN's open-source stack.
   The ~80MB model downloads once and is cached by the browser.
--------------------------------------------------------------------------- */

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const KOKORO_VOICE = "af_heart"; // warm, natural female

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let instance: any = null;
let loading: Promise<unknown> | null = null;

export function kokoroReady(): boolean {
  return !!instance;
}

export async function loadKokoro(): Promise<unknown> {
  if (instance) return instance;
  if (loading) return loading;
  loading = (async () => {
    const mod = await import("kokoro-js");
    const KokoroTTS = mod.KokoroTTS;
    // WASM/q8 is the reliable path in-browser (WebGPU session creation is flaky
    // for this model across devices). Slightly slower, but no hard errors.
    instance = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "wasm" });
    return instance;
  })();
  try {
    return await loading;
  } catch (e) {
    loading = null;
    throw e;
  }
}

/** Build a 16-bit PCM WAV ArrayBuffer from Float32 samples. */
function floatToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const wr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  wr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  wr(8, "WAVE");
  wr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  wr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/** Synthesize speech to a WAV ArrayBuffer (ready for decodeAudioData). */
export async function kokoroWav(text: string, voice: string = KOKORO_VOICE): Promise<ArrayBuffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tts: any = await loadKokoro();
  const audio = await tts.generate(text, { voice });
  if (audio && typeof audio.toBlob === "function") {
    return await audio.toBlob().arrayBuffer();
  }
  // Fallback: build WAV from raw samples.
  return floatToWav(audio.audio as Float32Array, audio.sampling_rate ?? 24000);
}
