"use client";

import { Volume2 } from "lucide-react";

/* Compact subtitle bar for spoken explanations — a clean glass strip near the
   bottom, not giant text floating over the view. Observations are shown as
   labels on the frame, so they're intentionally not repeated here. */
export function Captions({
  speech,
  interim,
  speaking,
}: {
  speech: string;
  interim: string;
  speaking?: boolean;
}) {
  if (!speech && !interim) return null;
  return (
    <div className="flex w-full flex-col items-center gap-2">
      {interim && (
        <p className="max-w-[88%] rounded-full glass px-4 py-1.5 text-sm text-ink-dim">{interim}…</p>
      )}
      {speech && (
        <div
          key={speech}
          className="glass-strong flex max-w-[92%] items-start gap-2.5 rounded-2xl px-4 py-3"
          style={{ animation: "float-up 0.35s ease both" }}
        >
          <Volume2
            size={16}
            className={`mt-0.5 shrink-0 text-accent ${speaking ? "animate-pulse" : "opacity-50"}`}
          />
          <p className="line-clamp-3 text-[15px] font-medium leading-snug text-ink">{speech}</p>
        </div>
      )}
    </div>
  );
}
