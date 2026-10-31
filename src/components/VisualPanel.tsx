"use client";

import { X } from "lucide-react";
import type { AssistantResponse } from "@/types/assistant";
import { DiagramRenderer } from "./DiagramRenderer";

/* Slide-up panel for diagrams and task progress. Never fully hides the camera —
   it's a sheet the user can dismiss instantly to return to the live view. */
export function VisualPanel({
  response,
  open,
  onClose,
  onToggleStep,
  onNodeTap,
}: {
  response: AssistantResponse | null;
  open: boolean;
  onClose: () => void;
  onToggleStep?: (id: string) => void;
  onNodeTap?: (label: string) => void;
}) {
  const visual = response?.visual;
  const task = response?.task_update;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 transition-transform duration-400 ${
        open ? "translate-y-0" : "translate-y-[110%]"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
    >
      <div className="pointer-events-auto glass-strong mx-auto max-h-[72vh] w-full max-w-xl overflow-hidden rounded-t-3xl border-b-0 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-white/20" />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pt-2">
          <div>
            <h3 className="text-base font-semibold text-ink">
              {visual?.title ?? task?.objective ?? "Explanation"}
            </h3>
            {visual?.caption && <p className="mt-0.5 text-xs text-ink-dim">{visual.caption}</p>}
          </div>
          <button onClick={onClose} className="ctrl !h-9 !w-9 btn-ghost" aria-label="Close panel">
            <X size={18} />
          </button>
        </div>

        <div className="thin-scroll max-h-[56vh] overflow-y-auto px-5 pb-6 pt-3">
          {visual && (
            <div className="rounded-2xl border border-line bg-black/20 p-2">
              <DiagramRenderer visual={visual} onNodeTap={onNodeTap} />
            </div>
          )}

          {task && task.steps.length > 0 && (
            <div className="mt-4 space-y-2">
              {task.note && <p className="text-xs text-ink-dim">{task.note}</p>}
              {task.steps.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onToggleStep?.(s.id)}
                  className="flex w-full items-center gap-3 rounded-xl glass px-3 py-2.5 text-left"
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                      s.status === "done"
                        ? "border-transparent bg-[var(--ok)] text-black"
                        : s.status === "active"
                          ? "border-accent text-accent"
                          : "border-white/25 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className={`text-sm ${s.status === "done" ? "text-ink-faint line-through" : "text-ink"}`}>
                    {s.text}
                  </span>
                </button>
              ))}
              <p className="pt-1 text-[11px] text-ink-faint">
                Tap a step to confirm it — LUMEN never completes steps for you.
              </p>
            </div>
          )}

          {!visual && (!task || task.steps.length === 0) && (
            <p className="py-8 text-center text-sm text-ink-dim">No visual for this answer yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
