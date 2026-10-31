"use client";

import { Cpu } from "lucide-react";

export function DownloadOverlay({
  open,
  progress,
  note,
  error,
  onCancel,
}: {
  open: boolean;
  progress: number;
  note: string;
  error: string | null;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="glass-strong w-full max-w-sm rounded-3xl p-6 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft">
          <Cpu className="text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-ink">Preparing on-device Gemma</h3>
        <p className="mt-1 text-xs text-ink-dim">
          The model downloads straight to your device and is cached for offline use. It never touches our server.
        </p>

        {error ? (
          <p className="mt-4 rounded-xl bg-[var(--danger)]/15 p-3 text-xs text-[var(--danger)]">{error}</p>
        ) : (
          <div className="mt-5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  background: "linear-gradient(100deg,var(--accent),var(--accent-2))",
                }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-dim">{note}</p>
          </div>
        )}

        <button onClick={onCancel} className="btn btn-ghost mt-5 h-10 w-full text-sm">
          {error ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
