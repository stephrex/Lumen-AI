"use client";

import type { Visual } from "@/types/assistant";

/* Renders a validated Visual object into SVG/React. The model only ever
   supplies DATA (nodes, edges, labels); we never execute model-generated
   markup or code. */

const KIND_COLOR: Record<string, string> = {
  component: "#5b8cff",
  input: "#43d6a0",
  output: "#9a6bff",
  process: "#5b8cff",
  decision: "#ffb64d",
  note: "#9aa3b8",
};

const W = 1000;
const H = 680;

export function DiagramRenderer({
  visual,
  onNodeTap,
}: {
  visual: Visual;
  onNodeTap?: (label: string) => void;
}) {
  // Exploded view: parts stacked along an assembly axis, pulled apart.
  if (visual.type === "exploded_view") {
    const parts = [...visual.nodes].sort((a, b) => a.y - b.y);
    return (
      <div className="exploded relative flex flex-col items-center gap-6 py-6">
        {/* central assembly axis */}
        <div className="pointer-events-none absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 border-l border-dashed border-accent/40" />
        {parts.map((n, i) => (
          <div
            key={n.id}
            className="relative flex w-full items-center justify-center"
            style={{ animation: `explode-in 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 0.1}s both` }}
          >
            <button
              onClick={onNodeTap ? () => onNodeTap(n.label) : undefined}
              className="exploded-plate h-12 w-44 rounded-[50%]"
              style={{ cursor: onNodeTap ? "pointer" : "default" }}
              aria-label={n.label}
            />
            {/* leader + label to the right */}
            <div className="absolute left-[calc(50%+6rem)] flex items-center gap-2">
              <span className="h-px w-6 bg-accent/50" />
              <span className="rounded-md glass px-2 py-1 text-xs font-medium text-ink">
                <span className="mono mr-1 text-accent">{i + 1}</span>
                {n.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (visual.type === "equation_visual" || (visual.steps && visual.nodes.length === 0)) {
    return (
      <div className="space-y-4">
        {visual.equation && (
          <div className="rounded-2xl glass p-5 text-center font-mono text-xl text-ink">
            {visual.equation}
          </div>
        )}
        {visual.steps && (
          <ol className="space-y-2">
            {visual.steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-xl glass p-3 text-sm text-ink-dim">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="text-ink">{s}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  const nodeById = new Map(visual.nodes.map((n) => [n.id, n]));
  const px = (x: number) => 60 + x * (W - 120);
  const py = (y: number) => 50 + y * (H - 100);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: "48vh" }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#8ea0c8" />
        </marker>
      </defs>

      {/* edges */}
      {visual.edges.map((e, i) => {
        const a = nodeById.get(e.from);
        const b = nodeById.get(e.to);
        if (!a || !b) return null;
        const x1 = px(a.x);
        const y1 = py(a.y);
        const x2 = px(b.x);
        const y2 = py(b.y);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return (
          <g key={i}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#8ea0c8"
              strokeWidth={2}
              strokeOpacity={0.55}
              markerEnd={e.directed ? "url(#arrow)" : undefined}
              strokeDasharray="6 500"
              strokeDashoffset={506}
              style={{ animation: `dash 0.7s ease ${0.1 * i}s forwards` }}
            />
            {e.label && (
              <text x={mx} y={my - 6} fill="#9aa3b8" fontSize={20} textAnchor="middle">
                {e.label}
              </text>
            )}
          </g>
        );
      })}

      {/* nodes */}
      {visual.nodes.map((n, i) => {
        const color = KIND_COLOR[n.kind] ?? "#5b8cff";
        const cx = px(n.x);
        const cy = py(n.y);
        const w = Math.max(120, n.label.length * 11 + 48);
        const h = 54;
        const diamond = n.kind === "decision";
        return (
          <g
            key={n.id}
            onClick={onNodeTap ? () => onNodeTap(n.label) : undefined}
            style={{
              animation: `float-up 0.4s ease ${0.06 * i}s both`,
              cursor: onNodeTap ? "pointer" : "default",
            }}
          >
            {diamond ? (
              <polygon
                points={`${cx},${cy - h * 0.8} ${cx + w / 2},${cy} ${cx},${cy + h * 0.8} ${cx - w / 2},${cy}`}
                fill="#121a2e"
                stroke={color}
                strokeWidth={2}
              />
            ) : (
              <rect
                x={cx - w / 2}
                y={cy - h / 2}
                width={w}
                height={h}
                rx={14}
                fill="#121a2e"
                stroke={color}
                strokeWidth={2}
              />
            )}
            <text x={cx} y={cy + 6} fill="#eef1f8" fontSize={20} fontWeight={600} textAnchor="middle">
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
