// Custom SVG sequence renderer — actor lanes with lifelines, message arrows
// between them, and clickable steps. No mermaid: steps are interactive so a
// click can open the typed payload for the selected version. Styling is kept
// simple and self-contained so the future concept-sim engine can share it.

// Minimal shapes so the renderer serves both message flows and the auth dance.
export interface Lane {
  id: string;
  label: string;
}
export interface SequenceStep {
  from: string;
  to: string;
  label: string;
  /** Drives arrow styling: solid request, muted result, dashed async. */
  message: "request" | "result" | "notification";
  optional?: boolean;
}

const LANE_WIDTH = 220;
const MARGIN_X = 24;
const HEADER_Y = 20;
const HEADER_H = 36;
const STEP_GAP = 60;
const STEP_TOP = HEADER_Y + HEADER_H + 30;

export function FlowDiagram({
  actors,
  steps,
  selected,
  onSelect,
}: {
  actors: Lane[];
  steps: SequenceStep[];
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const laneX = new Map(actors.map((a, i) => [a.id, MARGIN_X + LANE_WIDTH / 2 + i * LANE_WIDTH]));
  const width = MARGIN_X * 2 + LANE_WIDTH * actors.length;
  const height = STEP_TOP + STEP_GAP * steps.length + 20;
  const lifelineBottom = height - 12;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ maxWidth: "100%", fontFamily: "system-ui, sans-serif" }}
      role="img"
      aria-label="Message sequence"
    >
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
        </marker>
        <marker id="arrow-sel" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#0ea5e9" />
        </marker>
      </defs>

      {/* Actor headers and lifelines */}
      {actors.map((a) => {
        const x = laneX.get(a.id)!;
        return (
          <g key={a.id}>
            <line
              x1={x}
              y1={HEADER_Y + HEADER_H}
              x2={x}
              y2={lifelineBottom}
              stroke="#1e293b"
              strokeWidth={1}
            />
            <rect
              x={x - LANE_WIDTH / 2 + 20}
              y={HEADER_Y}
              width={LANE_WIDTH - 40}
              height={HEADER_H}
              rx={8}
              fill="#0b1120"
              stroke="#334155"
            />
            <text
              x={x}
              y={HEADER_Y + HEADER_H / 2 + 4}
              textAnchor="middle"
              fontSize={13}
              fontWeight={600}
              fill="#e2e8f0"
            >
              {a.label}
            </text>
          </g>
        );
      })}

      {/* Message arrows */}
      {steps.map((step, i) => {
        const x1 = laneX.get(step.from)!;
        const x2 = laneX.get(step.to)!;
        const y = STEP_TOP + STEP_GAP * i;
        const isSel = selected === i;
        const stroke = isSel ? "#0ea5e9" : step.message === "result" ? "#64748b" : "#94a3b8";
        const dashed = step.message === "notification";
        const rightward = x2 > x1;
        return (
          <g key={i} onClick={() => onSelect(i)} style={{ cursor: "pointer" }}>
            {/* wide transparent hit target for the whole row */}
            <rect x={0} y={y - STEP_GAP / 2} width={width} height={STEP_GAP} fill="transparent" />
            {isSel ? (
              <rect
                x={4}
                y={y - STEP_GAP / 2 + 6}
                width={width - 8}
                height={STEP_GAP - 12}
                rx={6}
                fill="#0ea5e918"
              />
            ) : null}
            <text
              x={(x1 + x2) / 2}
              y={y - 8}
              textAnchor="middle"
              fontSize={12}
              fill={isSel ? "#e2e8f0" : "#cbd5e1"}
              fontFamily="ui-monospace, monospace"
            >
              {step.label}
              {step.optional ? " (optional)" : ""}
            </text>
            <line
              x1={x1 + (rightward ? 6 : -6)}
              y1={y}
              x2={x2 + (rightward ? -6 : 6)}
              y2={y}
              stroke={stroke}
              strokeWidth={isSel ? 2 : 1.5}
              strokeDasharray={dashed ? "5 4" : undefined}
              markerEnd={`url(#${isSel ? "arrow-sel" : "arrow"})`}
              opacity={step.optional && !isSel ? 0.6 : 1}
            />
          </g>
        );
      })}
    </svg>
  );
}
