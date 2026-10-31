"use client";

import { Camera } from "lucide-react";
import type { DetectedBox } from "@/types/assistant";
import type { RegionSelection } from "@/engines/vision/vision-types";

/* Shows the exact frame LUMEN analysed, with Gemma's detected objects drawn as
   labelled boxes — the "it sees and points at things" moment. Boxes use Gemma's
   0..1000 [ymin,xmin,ymax,xmax] convention, mapped to % of the image. Each box
   is tappable to drill into that specific object. */
export function AnnotatedFrame({
  src,
  boxes,
  selection,
  maskDataUrl,
  analysing,
  onTapBox,
  onResume,
}: {
  src: string;
  boxes: DetectedBox[];
  selection?: RegionSelection | null;
  maskDataUrl?: string | null;
  analysing: boolean;
  onTapBox: (label: string) => void;
  onResume: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
      {/* shrink-wrap wrapper so box %s map exactly onto the image */}
      <div className="relative inline-block max-h-full max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Analysed frame" className="block max-h-dvh w-auto max-w-full" />

        {/* on-device segmentation mask highlight (aligned to the frame) */}
        {maskDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={maskDataUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ animation: "float-up 0.4s ease both", mixBlendMode: "screen" }}
          />
        )}

        {analysing && <div className="scanline" />}

        {boxes.map((b, i) => {
          const left = Math.min(b.xmin, b.xmax) / 10;
          const top = Math.min(b.ymin, b.ymax) / 10;
          const width = Math.abs(b.xmax - b.xmin) / 10;
          const height = Math.abs(b.ymax - b.ymin) / 10;
          const corner =
            "absolute h-3.5 w-3.5 border-accent transition group-active:border-accent-2";
          return (
            <button
              key={`${b.label}-${i}`}
              onClick={() => onTapBox(b.label)}
              className="group absolute"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                animation: `box-in 0.45s cubic-bezier(0.22,1,0.36,1) ${0.08 * i}s both`,
              }}
            >
              {/* faint fill + lock-on corner brackets */}
              <span className="absolute inset-0 rounded-sm bg-accent/5 ring-1 ring-accent/30" />
              <span className={`${corner} left-0 top-0 border-l-2 border-t-2 rounded-tl`} />
              <span className={`${corner} right-0 top-0 border-r-2 border-t-2 rounded-tr`} />
              <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2 rounded-bl`} />
              <span className={`${corner} bottom-0 right-0 border-b-2 border-r-2 rounded-br`} />
              <span className="mono absolute -top-6 left-0 whitespace-nowrap rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-[0_0_16px_-2px_rgba(91,140,255,0.9)]">
                {b.label}
              </span>
            </button>
          );
        })}

        {/* Point-and-Ask selection: crop box + crosshair at the tapped point */}
        {selection && (
          <>
            <span
              className="absolute rounded-md border-2 border-dashed border-[var(--accent-2)]"
              style={{
                left: `${selection.box.x * 100}%`,
                top: `${selection.box.y * 100}%`,
                width: `${selection.box.w * 100}%`,
                height: `${selection.box.h * 100}%`,
                boxShadow: "0 0 24px -4px var(--accent-2)",
                animation: "box-in 0.35s ease both",
              }}
            />
            <span
              className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
              style={{
                left: `${selection.point.x * 100}%`,
                top: `${selection.point.y * 100}%`,
                boxShadow: "0 0 16px 2px rgba(255,255,255,0.6)",
              }}
            />
          </>
        )}
      </div>

      {/* resume live camera — centred under the header, clear of the End-X */}
      <button
        onClick={onResume}
        className="btn btn-primary absolute left-1/2 top-16 z-30 h-10 -translate-x-1/2 gap-1.5 px-5 text-sm"
      >
        <Camera size={16} /> Live view
      </button>
    </div>
  );
}
