"use client";

import type { LumenState } from "@/lib/states";
import { STATE_META } from "@/lib/states";

/* Sci-fi HUD frame layered over the camera: corner brackets that lock green when
   idle and pulse while working, a scanning reticle during analysis, a faint tech
   grid, and a state-tinted edge glow. Pure overlay — no interaction cost. */
export function Hud({ state, model }: { state: LumenState; model: string }) {
  const tone = STATE_META[state].tone;
  const working = state === "OBSERVING" || state === "THINKING";
  const locked = state === "IDLE" || state === "GUIDING";

  return (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden" style={{ ["--hud-tint" as string]: tone }}>
      <div className="hud-glow" />
      <div className="hud-grid" />

      {/* corner brackets (CSS controls colour + glow for visibility) */}
      <span className={`hud-corner hud-tl ${locked ? "locked" : ""}`} />
      <span className={`hud-corner hud-tr ${locked ? "locked" : ""}`} />
      <span className={`hud-corner hud-bl ${locked ? "locked" : ""}`} />
      <span className={`hud-corner hud-br ${locked ? "locked" : ""}`} />

      {/* telemetry readout (top-left, under the logo) */}
      <div className="mono absolute left-4 top-11 text-[9px] uppercase tracking-[0.2em] text-ink-faint">
        <div>{model}</div>
        <div style={{ color: tone }}>◉ {STATE_META[state].label}</div>
      </div>

      {/* scanning reticle while analysing */}
      {working && (
        <div className="absolute left-1/2 top-[20%] -translate-x-1/2">
          <div className="relative h-44 w-44">
            <span
              className="absolute inset-0 rounded-full border border-dashed"
              style={{ borderColor: tone, opacity: 0.4, animation: "reticle-spin 8s linear infinite" }}
            />
            <span
              className="absolute inset-4 rounded-full border"
              style={{ borderColor: tone, opacity: 0.25, animation: "reticle-spin-rev 5s linear infinite" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
