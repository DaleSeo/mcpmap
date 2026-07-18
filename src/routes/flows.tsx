import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  FLOWS,
  flowPresence,
  isDeprecated,
  presentSteps,
  stepShape,
  typeLookup,
} from "../lib/flows.ts";
import { exampleFor } from "../lib/typeref.ts";
import { FlowDiagram } from "../components/FlowDiagram.tsx";
import { DEFAULT_VERSION, isVersion, loadArtifact, VERSIONS } from "../lib/data.ts";

interface FlowsSearch {
  flow?: string;
  v?: string;
  step?: number;
}

export const Route = createFileRoute("/flows")({
  validateSearch: (search: Record<string, unknown>): FlowsSearch => ({
    flow:
      typeof search.flow === "string" && FLOWS.some((f) => f.id === search.flow)
        ? search.flow
        : undefined,
    v: typeof search.v === "string" && isVersion(search.v) ? search.v : undefined,
    step: typeof search.step === "number" ? search.step : undefined,
  }),
  loaderDeps: ({ search }) => ({ v: search.v ?? DEFAULT_VERSION }),
  loader: ({ deps }) => loadArtifact(deps.v),
  component: Flows,
});

function Flows() {
  const artifact = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const version = artifact.version;

  const flow = FLOWS.find((f) => f.id === search.flow) ?? FLOWS[0]!;
  const steps = useMemo(() => presentSteps(flow, artifact), [flow, artifact]);
  const present = flowPresence(flow, artifact) === "present";
  const deprecated = isDeprecated(flow, version);

  const selected =
    typeof search.step === "number" && search.step < steps.length ? search.step : null;

  const setVersion = (v: string) =>
    void navigate({
      search: (s) => ({ ...s, v: v === DEFAULT_VERSION ? undefined : v, step: undefined }),
    });
  const setFlow = (id: string) =>
    void navigate({ search: (s) => ({ ...s, flow: id, step: undefined }) });
  const setStep = (i: number) => void navigate({ search: (s) => ({ ...s, step: i }) });

  const payload = useMemo(() => {
    if (selected === null) return null;
    const step = steps[selected]!;
    const shape = stepShape(step, artifact);
    return shape ? exampleFor(shape, typeLookup(artifact)) : null;
  }, [selected, steps, artifact]);

  return (
    <main
      style={{
        display: "flex",
        minHeight: "100dvh",
        fontFamily: "system-ui, sans-serif",
        color: "#e2e8f0",
        background: "#020617",
      }}
    >
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: "1px solid #1e293b",
          padding: 16,
          overflowY: "auto",
        }}
      >
        <h1 style={{ fontSize: 16, margin: "0 0 4px" }}>mcpmap</h1>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px" }}>Message flows</p>
        <Link
          to="/explore"
          search={{}}
          style={{ color: "#0ea5e9", fontSize: 12, display: "block", marginBottom: 12 }}
        >
          Type explorer →
        </Link>

        <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 16 }}>
          Spec version
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #1e293b",
              background: "#0b1120",
              color: "#e2e8f0",
            }}
          >
            {VERSIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            margin: "0 0 8px",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Flows
        </div>
        {FLOWS.map((f) => {
          const active = f.id === flow.id;
          const isPresent = flowPresence(f, artifact) === "present";
          const dep = isDeprecated(f, version);
          return (
            <button
              key={f.id}
              onClick={() => setFlow(f.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                marginBottom: 4,
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid #1e293b",
                background: active ? "#1e293b" : "transparent",
                color: isPresent ? "#e2e8f0" : "#64748b",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span>{f.title}</span>
                {!isPresent ? (
                  <Badge color="#64748b">not in {version}</Badge>
                ) : dep ? (
                  <Badge color="#f59e0b">deprecated</Badge>
                ) : null}
              </div>
            </button>
          );
        })}
      </aside>

      <div style={{ flex: 1, minWidth: 0, padding: "24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>{flow.title}</h2>
          {deprecated ? <Badge color="#f59e0b">deprecated in {version}</Badge> : null}
        </div>
        <p style={{ color: "#94a3b8", fontSize: 13, maxWidth: 640, margin: "6px 0 20px" }}>
          {flow.summary}
        </p>

        {present ? (
          <>
            <div
              style={{
                overflowX: "auto",
                border: "1px solid #1e293b",
                borderRadius: 10,
                background: "#020617",
                padding: 8,
                marginBottom: 20,
              }}
            >
              <FlowDiagram
                actors={flow.actors}
                steps={steps}
                selected={selected}
                onSelect={setStep}
              />
            </div>

            {selected !== null ? (
              <section>
                <h3
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "#94a3b8",
                    margin: "0 0 8px",
                  }}
                >
                  {steps[selected]!.method} · {steps[selected]!.message} payload · {version}
                </h3>
                <pre
                  style={{
                    margin: 0,
                    padding: 14,
                    borderRadius: 8,
                    background: "#0b1120",
                    border: "1px solid #1e293b",
                    overflowX: "auto",
                    fontSize: 12,
                    fontFamily: "ui-monospace, monospace",
                    color: "#e2e8f0",
                  }}
                >
                  {payload !== null ? JSON.stringify(payload, null, 2) : "No payload."}
                </pre>
              </section>
            ) : (
              <p style={{ color: "#64748b", fontSize: 13 }}>
                Click a message to see its typed payload for {version}.
              </p>
            )}
          </>
        ) : (
          <p style={{ color: "#64748b" }}>
            This flow is not present in {version} — {flow.title.toLowerCase()} relies on methods
            removed in this version.
          </p>
        )}
      </div>
    </main>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        color,
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: "1px 5px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
