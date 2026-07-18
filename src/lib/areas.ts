// Feature-area colors, shared by the explorer graph and the capability matrix
// so an area reads as the same hue everywhere.

export const AREA_COLOR: Record<string, string> = {
  lifecycle: "#6366f1",
  tools: "#0ea5e9",
  resources: "#10b981",
  prompts: "#f59e0b",
  sampling: "#ec4899",
  elicitation: "#8b5cf6",
  roots: "#14b8a6",
  logging: "#64748b",
  completion: "#f43f5e",
  tasks: "#eab308",
  progress: "#22c55e",
  common: "#94a3b8",
};

export const COMMON_COLOR = "#94a3b8";

export function areaColor(area: string): string {
  return AREA_COLOR[area] ?? COMMON_COLOR;
}
