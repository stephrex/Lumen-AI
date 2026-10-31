"use client";

import { Cpu, Cloud, FlaskConical } from "lucide-react";
import type { ProcessingMode } from "@/types/assistant";

/* Transparent indication of where the last answer was processed. */
export function ProcessingBadge({ mode }: { mode: ProcessingMode | null }) {
  if (!mode) return null;
  const map = {
    local: { icon: Cpu, label: "On-device Gemma", color: "var(--ok)" },
    cloud: { icon: Cloud, label: "Gemma 4", color: "var(--accent)" },
    demo: { icon: FlaskConical, label: "Demo", color: "var(--warn)" },
  } as const;
  const { icon: Icon, label, color } = map[mode];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-1 text-[11px] font-medium"
      style={{ color }}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}
