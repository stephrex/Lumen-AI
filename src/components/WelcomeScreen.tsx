"use client";

import { useState } from "react";
import { Compass, GraduationCap, Wrench, ArrowRight, Cpu, Cloud, Camera, Mic, ChevronRight } from "lucide-react";
import { VoiceOrb } from "./VoiceOrb";
import type { LumenMode } from "@/types/assistant";
import type { EngineStatus } from "@/lib/ai/engine";

const MODES: { id: LumenMode; title: string; desc: string; icon: typeof Compass }[] = [
  { id: "explore", title: "Explore", desc: "Point at anything and understand what it is.", icon: Compass },
  { id: "learn", title: "Learn", desc: "Grasp how something works, from the real thing.", icon: GraduationCap },
  { id: "fix", title: "Do / Fix", desc: "Get guided, safe, step-by-step help with a task.", icon: Wrench },
];

export function WelcomeScreen({
  status,
  onStart,
  onEnableLocal,
}: {
  status: EngineStatus | null;
  onStart: (mode: LumenMode) => void;
  onEnableLocal: () => void;
}) {
  const [mode, setMode] = useState<LumenMode>("explore");
  const caps = status?.capabilities;

  return (
    <main className="lumen-ambient relative flex min-h-dvh flex-col overflow-hidden">
      {/* hero */}
      <section className="flex flex-col items-center px-6 pt-14 text-center">
        <VoiceOrb state="IDLE" size={108} />
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">
          <span className="text-gradient">LUMEN</span>
        </h1>
        <p className="mt-2 max-w-xs text-pretty text-sm leading-relaxed text-ink-dim">
          Intelligence beside you. Show it the world, speak naturally, and understand what you see.
        </p>
      </section>

      {/* modes */}
      <section className="mt-8 flex-1 px-5">
        <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest text-ink-faint">Choose a mode</p>
        <div className="space-y-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const selected = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left transition ${
                  selected ? "glass-strong ring-1 ring-accent/60" : "glass"
                }`}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                  style={{
                    background: selected ? "linear-gradient(100deg,var(--accent),var(--accent-2))" : "rgba(255,255,255,0.05)",
                  }}
                >
                  <Icon size={20} className={selected ? "text-white" : "text-ink-dim"} />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{m.title}</span>
                  <span className="block text-xs text-ink-dim">{m.desc}</span>
                </span>
                <ChevronRight size={18} className={selected ? "text-accent" : "text-ink-faint"} />
              </button>
            );
          })}
        </div>
      </section>

      {/* engine status */}
      <section className="px-5 pt-5">
        <div className="glass rounded-2xl p-3.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-dim">
            <Chip ok={!!caps?.camera} icon={Camera} label="Camera" />
            <Chip ok={!!caps?.speechRecognition} icon={Mic} label="Voice" />
            <Chip ok={!!caps?.webgpu} icon={Cpu} label="WebGPU" />
            <Chip ok={!!status?.cloudConfigured} icon={Cloud} label="Cloud key" />
          </div>

          {status?.localModelConfigured && caps?.localInferenceLikely && !status.localEnabled && (
            <button
              onClick={onEnableLocal}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-soft py-2 text-xs font-medium text-accent"
            >
              <Cpu size={14} /> Enable on-device Gemma (downloads model)
            </button>
          )}
          {status?.localEnabled && (
            <p className="mt-2 text-[11px] text-[var(--ok)]">On-device Gemma ready — text runs offline.</p>
          )}
          {!status?.cloudConfigured && !status?.localEnabled && (
            <p className="mt-2 text-[11px] text-ink-faint">
              No model connected yet — running in labelled <span className="text-[var(--warn)]">Demo</span> mode. Add a
              key or enable on-device to use real AI.
            </p>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="sticky bottom-0 px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-4">
        <button
          onClick={() => onStart(mode)}
          className="btn btn-primary h-14 w-full text-base"
        >
          Start session <ArrowRight size={18} />
        </button>
        <p className="mt-2.5 text-center text-[11px] text-ink-faint">
          Camera & microphone are requested only when you start, and never uploaded without your consent.
        </p>
      </section>
    </main>
  );
}

function Chip({ ok, icon: Icon, label }: { ok: boolean; icon: typeof Camera; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} className={ok ? "text-[var(--ok)]" : "text-ink-faint"} />
      <span className={ok ? "text-ink-dim" : "text-ink-faint line-through"}>{label}</span>
    </span>
  );
}
