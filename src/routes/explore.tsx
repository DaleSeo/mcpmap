import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { areaSubgraph, neighborhood, type GraphNode } from "../lib/graph.ts";
import { layout, NODE_HEIGHT, NODE_WIDTH } from "../lib/layout.ts";
import { DEFAULT_VERSION, loadArtifact } from "../lib/data.ts";

export const Route = createFileRoute("/explore")({
  loader: () => loadArtifact(DEFAULT_VERSION),
  component: Explore,
});

/** One stable hue per feature area, so a type keeps its color across views. */
const AREA_COLOR: Record<string, string> = {
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

const areaColor = (area: string) => AREA_COLOR[area] ?? AREA_COLOR.common;

// React Flow requires node data to be an index-signature record.
type TypeNodeData = GraphNode & { focused: boolean; [key: string]: unknown };
type FlowNode = Node<TypeNodeData, "type">;

function TypeNode({ data }: NodeProps<FlowNode>) {
  return (
    <div
      title={data.description}
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        boxSizing: "border-box",
        borderRadius: 8,
        border: `2px solid ${areaColor(data.area)}`,
        outline: data.focused ? `3px solid ${areaColor(data.area)}` : "none",
        outlineOffset: 2,
        background: "#0b1120",
        color: "#e2e8f0",
        padding: "6px 10px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span
        style={{
          fontWeight: 600,
          fontSize: 13,
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          overflow: "hidden",
        }}
      >
        {data.id}
      </span>
      <span style={{ fontSize: 11, color: areaColor(data.area) }}>{data.kind}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { type: TypeNode };

/**
 * The React Flow canvas. Split out so it can sit under a ReactFlowProvider and
 * re-fit the viewport whenever the node set changes — the base `fitView` prop
 * only fits on mount, which would leave refocus and area switches off-screen.
 */
function GraphCanvas({
  nodes,
  edges,
  onFocus,
}: {
  nodes: FlowNode[];
  edges: Edge[];
  onFocus: (id: string) => void;
}) {
  const rf = useReactFlow();
  useEffect(() => {
    if (nodes.length === 0) return;
    // Wait one frame so React Flow has measured the freshly-set nodes.
    const frame = requestAnimationFrame(() => void rf.fitView({ duration: 300, padding: 0.2 }));
    return () => cancelAnimationFrame(frame);
  }, [nodes, rf]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onFocus(node.id)}
      fitView
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
      style={{ background: "#020617" }}
    >
      <Background color="#1e293b" gap={24} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

function Explore() {
  const artifact = Route.useLoaderData();

  // Default to the first non-empty area the clustering produced.
  const [area, setArea] = useState(() => artifact.clusters[0]?.area ?? "common");
  const [focus, setFocus] = useState<string | null>(null);

  // The bounded view: a type's neighborhood when one is focused, else the area
  // subgraph. Focusing crosses areas; picking an area clears the focus.
  const sub = useMemo(
    () => (focus ? neighborhood(artifact, focus, 2) : areaSubgraph(artifact, area)),
    [artifact, area, focus],
  );

  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    let live = true;
    void layout(sub).then((positions) => {
      if (!live) return;
      setNodes(
        sub.nodes.map((n) => ({
          id: n.id,
          type: "type" as const,
          position: positions.get(n.id) ?? { x: 0, y: 0 },
          data: { ...n, focused: n.id === focus },
        })),
      );
      setEdges(
        sub.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          style: { stroke: "#475569" },
        })),
      );
    });
    return () => {
      live = false;
    };
  }, [sub, focus]);

  // React Flow measures the DOM, so it only renders client-side. During
  // prerender/hydration we emit a stable placeholder.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main
      style={{
        display: "flex",
        height: "100dvh",
        fontFamily: "system-ui, sans-serif",
        color: "#e2e8f0",
        background: "#020617",
      }}
    >
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid #1e293b",
          padding: 16,
          overflowY: "auto",
        }}
      >
        <h1 style={{ fontSize: 16, margin: "0 0 4px" }}>mcpmap</h1>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 16px" }}>
          Type explorer · {artifact.version}
        </p>

        {focus ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Focused</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{focus}</div>
            <button onClick={() => setFocus(null)} style={buttonStyle(true)}>
              ← Back to area
            </button>
          </div>
        ) : null}

        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            margin: "0 0 8px",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Feature areas
        </div>
        {artifact.clusters.map((c) => {
          const active = !focus && c.area === area;
          return (
            <button
              key={c.area}
              onClick={() => {
                setFocus(null);
                setArea(c.area);
              }}
              style={{ ...buttonStyle(active), borderLeft: `3px solid ${areaColor(c.area)}` }}
            >
              <span>{c.label}</span>
              <span style={{ color: "#64748b" }}>{c.types.length}</span>
            </button>
          );
        })}
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        {mounted ? (
          <ReactFlowProvider>
            <GraphCanvas nodes={nodes} edges={edges} onFocus={setFocus} />
          </ReactFlowProvider>
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#475569" }}>
            Loading graph…
          </div>
        )}
      </div>
    </main>
  );
}

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    textAlign: "left",
    padding: "6px 10px",
    marginBottom: 4,
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid #1e293b",
    background: active ? "#1e293b" : "transparent",
    color: "#e2e8f0",
    cursor: "pointer",
  };
}
