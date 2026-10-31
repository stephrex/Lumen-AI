/* ---------------------------------------------------------------------------
   Model manager. Downloads a large model file to the device with progress,
   caches it in the Cache Storage API (so a second launch is instant and works
   offline), and hands back an object URL for the inference runtime.

   Weights never touch the Next.js server or the repo — they stream straight
   from the model host to the user's device.
--------------------------------------------------------------------------- */

const MODEL_CACHE = "lumen-models-v1";

export async function isModelCached(url: string): Promise<boolean> {
  if (!("caches" in globalThis) || !url) return false;
  try {
    const cache = await caches.open(MODEL_CACHE);
    const hit = await cache.match(url);
    return !!hit;
  } catch {
    return false;
  }
}

export async function clearModelCache(): Promise<void> {
  if (!("caches" in globalThis)) return;
  await caches.delete(MODEL_CACHE).catch(() => {});
}

/**
 * Returns an object URL for the model, downloading + caching it if needed.
 * `onProgress` receives 0..1 (best-effort; may jump to 1 if size is unknown).
 */
export async function fetchModelToObjectUrl(
  url: string,
  onProgress?: (p: number) => void
): Promise<string> {
  const cache = "caches" in globalThis ? await caches.open(MODEL_CACHE) : null;

  // Serve from cache if present.
  if (cache) {
    const cached = await cache.match(url);
    if (cached) {
      onProgress?.(1);
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }
  }

  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Model download failed (${res.status}). Check the model URL and licence access.`);
  }

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total) onProgress?.(Math.min(received / total, 0.999));
    }
  }

  const blob = new Blob(chunks as BlobPart[], {
    type: res.headers.get("content-type") || "application/octet-stream",
  });

  // Best-effort cache for offline reuse.
  if (cache) {
    try {
      await cache.put(url, new Response(blob, { headers: res.headers }));
    } catch {
      /* storage full / quota — continue without caching */
    }
  }

  onProgress?.(1);
  return URL.createObjectURL(blob);
}
