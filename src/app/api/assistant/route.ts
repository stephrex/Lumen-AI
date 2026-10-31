import { NextResponse } from "next/server";
import { AssistantResponse, type AssistantRequest } from "@/types/assistant";
import { buildSystemPrompt, responseJsonShape, GEMINI_RESPONSE_SCHEMA } from "@/lib/ai/prompt";

/* ---------------------------------------------------------------------------
   Cloud inference proxy. Holds the API key server-side. Supports Anthropic
   (Claude, with vision) and Google Gemini. Selected via env; see .env.example.
   Returns schema-valid AssistantResponse JSON, or { configured:false } on GET.
--------------------------------------------------------------------------- */

type Provider = "anthropic" | "gemini" | "none";

function resolveProvider(): { provider: Provider; key: string; model: string } {
  const explicit = (process.env.GEMMA_PROVIDER || "").toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMMA_API_KEY || "";

  if (explicit === "anthropic" && anthropicKey)
    return { provider: "anthropic", key: anthropicKey, model: process.env.GEMMA_MODEL || "claude-sonnet-5" };
  if (explicit === "gemini" && geminiKey)
    return { provider: "gemini", key: geminiKey, model: process.env.GEMMA_MODEL || "gemini-2.5-flash" };

  // Auto: prefer whichever key exists.
  if (anthropicKey) return { provider: "anthropic", key: anthropicKey, model: process.env.GEMMA_MODEL || "claude-sonnet-5" };
  if (geminiKey) return { provider: "gemini", key: geminiKey, model: process.env.GEMMA_MODEL || "gemini-2.5-flash" };
  return { provider: "none", key: "", model: "" };
}

export async function GET() {
  const { provider } = resolveProvider();
  return NextResponse.json({ configured: provider !== "none", provider });
}

function dataUrlToParts(dataUrl: string): { mime: string; base64: string } | null {
  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

/* Robustly pull the assistant JSON out of chatty / reasoning-style output.
   Scans for every balanced {...} span (string-aware) and returns the best one
   that parses and looks like our contract. */
function extractJson(text: string): unknown {
  const candidates: string[] = [];

  // 1) Prefer a fenced ```json block if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1]);

  // 2) Brace-match every top-level object, ignoring braces inside strings.
  let depth = 0;
  let startIdx = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) startIdx = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && startIdx !== -1) {
        candidates.push(text.slice(startIdx, i + 1));
        startIdx = -1;
      }
    }
  }

  // Try the most contract-like, largest candidates first.
  const ranked = candidates
    .map((c) => c.trim())
    .sort((a, b) => {
      const score = (s: string) => (/"speech_text"|"message"/.test(s) ? 1 : 0);
      return score(b) - score(a) || b.length - a.length;
    });

  for (const c of ranked) {
    try {
      return JSON.parse(c);
    } catch {
      /* try next */
    }
  }
  throw new Error("No parseable JSON object in model output");
}

export async function POST(request: Request) {
  const { provider, key, model } = resolveProvider();
  if (provider === "none") {
    return NextResponse.json(
      { error: "No cloud model configured. Add ANTHROPIC_API_KEY or GEMINI_API_KEY to .env.local." },
      { status: 503 }
    );
  }

  let req: AssistantRequest;
  try {
    req = (await request.json()) as AssistantRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const system = buildSystemPrompt(req.mode);
  const utterance = req.utterance || "(no spoken input — describe and explain what you see)";
  // Anthropic has no controlled-generation here, so it gets the explicit shape.
  const anthropicText =
    `${utterance}\n\nRespond with ONE raw JSON object only, in exactly this shape:\n${responseJsonShape}`;
  // Gemini/Gemma use responseSchema, so a short, natural instruction is enough.
  const geminiText =
    `${utterance}\n\nAnswer as the LUMEN assistant. Include a "visual" diagram when it ` +
    `genuinely aids understanding. Keep speech_text natural and concise.`;

  try {
    let modelText: string;

    if (provider === "anthropic") {
      const content: unknown[] = [];
      if (req.imageDataUrl) {
        const img = dataUrlToParts(req.imageDataUrl);
        if (img)
          content.push({
            type: "image",
            source: { type: "base64", media_type: img.mime, data: img.base64 },
          });
      }
      content.push({ type: "text", text: anthropicText });

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system,
          messages: [{ role: "user", content }],
        }),
      });
      if (!r.ok) throw new Error(`Anthropic error ${r.status}: ${await r.text()}`);
      const j = await r.json();
      modelText = j?.content?.[0]?.text ?? "";
    } else {
      // gemini / gemma — both served here, both support controlled generation.
      const parts: unknown[] = [{ text: `${system}\n\n${geminiText}` }];
      if (req.imageDataUrl) {
        const img = dataUrlToParts(req.imageDataUrl);
        if (img) parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
      }
      // responseSchema constrains decoding to valid JSON — no reasoning preamble,
      // which is what makes the Gemma "thinking" model fast and reliable here.
      // Higher temperature + topP/topK avoids the repetition loops this model
      // falls into at low temp under schema constraint. (Penalties aren't
      // supported on Gemma.) Capped tokens limit damage if it ever does loop.
      const generationConfig = {
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 600,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      };
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
        }
      );
      if (!r.ok) throw new Error(`Gemini error ${r.status}: ${await r.text()}`);
      const j = await r.json();
      modelText = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    const parsed = extractJson(modelText);
    const validated = AssistantResponse.parse({
      ...(parsed as object),
      processing_mode: "cloud",
    });
    return NextResponse.json(validated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown cloud error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
