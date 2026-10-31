/* ---------------------------------------------------------------------------
   Image preprocessing helpers: a cheap perceptual hash (for duplicate-frame
   suppression) and Hamming distance between hashes.
--------------------------------------------------------------------------- */

/** 16x16 grayscale average-hash. Returns a bitstring; similar frames → close hashes. */
export function frameHash(source: CanvasImageSource, size = 16): string {
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  try {
    ctx.drawImage(source, 0, 0, size, size);
  } catch {
    return "";
  }
  const data = ctx.getImageData(0, 0, size, size).data;
  const gray: number[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    gray.push(g);
    sum += g;
  }
  const avg = sum / gray.length;
  return gray.map((g) => (g > avg ? "1" : "0")).join("");
}

export function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return Math.max(a.length, b.length, 1);
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}
