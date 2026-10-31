"use client";

import type { LumenState } from "@/lib/states";
import { STATE_META } from "@/lib/states";

/* The animated LUMEN presence. Its motion encodes the current state so the
   user always knows whether it's listening, thinking or speaking. */
export function VoiceOrb({ state, size = 120 }: { state: LumenState; size?: number }) {
  const tone = STATE_META[state].tone;
  const active = state === "LISTENING" || state === "SPEAKING" || state === "THINKING" || state === "OBSERVING";
  const spinning = state === "THINKING";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* expanding pulse rings */}
      {active &&
        [0, 0.6, 1.2].map((delay, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: size * 0.7,
              height: size * 0.7,
              border: `1px solid ${tone}`,
              animation: `ring-pulse 2.4s ease-out ${delay}s infinite`,
            }}
          />
        ))}

      {/* rotating gradient halo while thinking */}
      <span
        className="absolute rounded-full"
        style={{
          width: size * 0.92,
          height: size * 0.92,
          background: `conic-gradient(from 0deg, transparent, ${tone}66, transparent 65%)`,
          filter: "blur(6px)",
          opacity: spinning ? 0.9 : 0.35,
          animation: spinning ? "orb-spin 1.4s linear infinite" : "orb-breathe 4s ease-in-out infinite",
        }}
      />

      {/* core */}
      <span
        className="relative rounded-full"
        style={{
          width: size * 0.56,
          height: size * 0.56,
          background: `radial-gradient(circle at 35% 30%, #ffffff, ${tone} 55%, ${tone}00 100%), radial-gradient(circle at 70% 75%, ${tone}, #1b2440 90%)`,
          boxShadow: `0 0 36px -4px ${tone}, inset 0 0 20px -6px #ffffff`,
          animation: "orb-breathe 3.6s ease-in-out infinite",
        }}
      />
    </div>
  );
}
