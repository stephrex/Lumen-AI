"use client";

import { Mic, MicOff, Scan, Layers, Pause, Play, SwitchCamera } from "lucide-react";

export interface ControlBarProps {
  listening: boolean;
  paused: boolean;
  thinking: boolean;
  canSwitchCamera: boolean;
  hasVisual: boolean;
  onMic: () => void;
  onAnalyse: () => void;
  onToggleVisual: () => void;
  onPauseResume: () => void;
  onSwitchCamera: () => void;
}

export function ControlBar(p: ControlBarProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
      <div
        className="mx-auto flex w-full max-w-md items-center justify-around px-6"
        style={{ background: "linear-gradient(0deg, rgba(5,6,10,0.85), transparent)" }}
      >
        {/* secondary left */}
        <button
          className="ctrl btn-ghost disabled:opacity-30"
          onClick={p.onSwitchCamera}
          disabled={!p.canSwitchCamera}
          aria-label="Switch camera"
        >
          <SwitchCamera size={20} />
        </button>

        {/* analyse */}
        <button className="ctrl btn-ghost" onClick={p.onAnalyse} disabled={p.thinking} aria-label="Analyse frame">
          <Scan size={22} className={p.thinking ? "animate-pulse text-accent" : ""} />
        </button>

        {/* mic — primary, larger */}
        <button
          onClick={p.onMic}
          aria-label={p.listening ? "Stop listening" : "Start talking"}
          className="ctrl !h-[72px] !w-[72px]"
          style={{
            background: p.listening
              ? "linear-gradient(100deg,#43d6a0,#5b8cff)"
              : "linear-gradient(100deg,var(--accent),var(--accent-2))",
            boxShadow: p.listening
              ? "0 0 0 6px rgba(67,214,160,0.18), 0 12px 40px -10px rgba(67,214,160,0.7)"
              : "0 12px 40px -10px rgba(91,140,255,0.7)",
            color: "white",
          }}
        >
          {p.listening ? <Mic size={28} /> : <MicOff size={28} />}
        </button>

        {/* visual panel */}
        <button
          className="ctrl btn-ghost disabled:opacity-30"
          onClick={p.onToggleVisual}
          disabled={!p.hasVisual}
          aria-label="Show visual explanation"
        >
          <Layers size={20} className={p.hasVisual ? "text-accent" : ""} />
        </button>

        {/* pause / resume */}
        <button className="ctrl btn-ghost" onClick={p.onPauseResume} aria-label={p.paused ? "Resume" : "Pause"}>
          {p.paused ? <Play size={20} /> : <Pause size={20} />}
        </button>
      </div>
    </div>
  );
}
