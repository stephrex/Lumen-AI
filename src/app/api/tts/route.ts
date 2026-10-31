import { NextResponse } from "next/server";

/* ---------------------------------------------------------------------------
   Neural TTS via Gemini's text-to-speech model (uses the same free key).
   Returns a ready-to-play WAV. The model emits raw 16-bit PCM, so we wrap it
   in a minimal WAV header here. Falls back (503) to browser speech if no key.
--------------------------------------------------------------------------- */

const TTS_MODEL = process.env.GEMMA_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const DEFAULT_VOICE = process.env.GEMMA_TTS_VOICE || "Aoede"; // warm, natural

function key(): string {
  return process.env.GEMINI_API_KEY || process.env.GEMMA_API_KEY || "";
}

export async function GET() {
  return NextResponse.json({ configured: !!key() });
}

/** Wrap raw PCM (16-bit LE mono) in a WAV container. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(1, 22); // channels = mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

function sampleRateFromMime(mime: string | undefined): number {
  const m = mime?.match(/rate=(\d+)/);
  return m ? parseInt(m[1], 10) : 24000;
}

export async function POST(request: Request) {
  const k = key();
  if (!k) return NextResponse.json({ error: "No TTS key configured" }, { status: 503 });

  let text = "";
  let voice = DEFAULT_VOICE;
  try {
    const body = await request.json();
    text = (body.text || "").toString().slice(0, 1200);
    if (body.voice) voice = String(body.voice);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!text.trim()) return NextResponse.json({ error: "Empty text" }, { status: 400 });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${k}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      }
    );
    if (!r.ok) return NextResponse.json({ error: `TTS ${r.status}` }, { status: 502 });
    const j = await r.json();
    const inline = j?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inline?.data) return NextResponse.json({ error: "No audio returned" }, { status: 502 });

    const pcm = Buffer.from(inline.data, "base64");
    const wav = pcmToWav(pcm, sampleRateFromMime(inline.mimeType));
    return new NextResponse(new Uint8Array(wav), {
      headers: { "content-type": "audio/wav", "cache-control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
