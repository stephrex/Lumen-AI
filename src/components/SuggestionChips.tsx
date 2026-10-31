"use client";

import type { AssistantResponse, LumenMode } from "@/types/assistant";

/* Tappable follow-up chips. The model's next_action becomes the first chip;
   the rest are quick, always-useful redirections. Tapping one fires a new turn. */

const COMMON = ["Explain more simply", "Show me how it works", "What should I check next?"];
const MODE_EXTRA: Record<LumenMode, string[]> = {
  explore: ["What is this used for?"],
  learn: ["Give me an example"],
  fix: ["What's the next step?"],
};

export function SuggestionChips({
  response,
  mode,
  disabled,
  onPick,
}: {
  response: AssistantResponse | null;
  mode: LumenMode;
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  const chips: string[] = [];
  if (response?.next_action) chips.push(response.next_action);
  for (const c of [...MODE_EXTRA[mode], ...COMMON]) {
    if (chips.length >= 4) break;
    if (!chips.includes(c)) chips.push(c);
  }
  if (!chips.length) return null;

  return (
    <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
      {chips.map((c, i) => (
        <button
          key={i}
          disabled={disabled}
          onClick={() => onPick(c)}
          className="max-w-[80%] truncate rounded-full glass-strong px-3.5 py-2 text-xs font-medium text-ink shadow-lg transition active:scale-95 disabled:opacity-40"
          style={{ animation: `float-up 0.35s ease ${0.05 * i}s both` }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
