import { createFileRoute, Link } from "@tanstack/react-router";
import { bySide, capabilityMatrix, type CapabilityRow } from "../lib/capabilities.ts";
import { directionBadge } from "../lib/methods.ts";
import { areaColor } from "../lib/areas.ts";
import { DEFAULT_VERSION, isVersion, loadArtifact, VERSIONS } from "../lib/data.ts";

interface CapabilitiesSearch {
  v?: string;
}

export const Route = createFileRoute("/capabilities")({
  validateSearch: (search: Record<string, unknown>): CapabilitiesSearch => ({
    v: typeof search.v === "string" && isVersion(search.v) ? search.v : undefined,
  }),
  loaderDeps: ({ search }) => ({ v: search.v ?? DEFAULT_VERSION }),
  loader: ({ deps }) => loadArtifact(deps.v),
  component: Capabilities,
});

function Capabilities() {
  const artifact = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { client, server } = bySide(capabilityMatrix(artifact));

  const setVersion = (v: string) =>
    void navigate({ search: () => ({ v: v === DEFAULT_VERSION ? undefined : v }) });

  return (
    <main
      style={{
        minHeight: "100dvh",
        fontFamily: "system-ui, sans-serif",
        color: "#e2e8f0",
        background: "#020617",
        padding: "24px 32px",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Capabilities</h1>
        <Link to="/explore" search={search} style={{ color: "#0ea5e9", fontSize: 13 }}>
          ← Type explorer
        </Link>
      </header>
      <p style={{ color: "#94a3b8", fontSize: 13, maxWidth: 640, margin: "0 0 16px" }}>
        Which capability each side declares during initialization, and the methods it unlocks.
        Follow a method into the type explorer to inspect its shape.
      </p>

      <label style={{ fontSize: 12, color: "#94a3b8", display: "inline-block", marginBottom: 24 }}>
        Spec version{" "}
        <select
          value={artifact.version}
          onChange={(e) => setVersion(e.target.value)}
          style={{
            marginLeft: 6,
            padding: "4px 8px",
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
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
        }}
      >
        <CapabilityColumn title="Client capabilities" rows={client} version={search.v} />
        <CapabilityColumn title="Server capabilities" rows={server} version={search.v} />
      </div>
    </main>
  );
}

function CapabilityColumn({
  title,
  rows,
  version,
}: {
  title: string;
  rows: CapabilityRow[];
  version: string | undefined;
}) {
  return (
    <section>
      <h2
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#94a3b8",
          margin: "0 0 12px",
        }}
      >
        {title}
      </h2>
      {rows.map((row) => (
        <div
          key={`${row.side}-${row.name}`}
          style={{ border: "1px solid #1e293b", borderRadius: 8, padding: 14, marginBottom: 12 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700 }}>{row.name}</span>
            <span
              style={{
                fontSize: 11,
                color: areaColor(row.area),
                border: `1px solid ${areaColor(row.area)}`,
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              {row.area}
            </span>
          </div>
          {row.description ? (
            <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 10px" }}>{row.description}</p>
          ) : null}

          {row.methods.length > 0 ? (
            row.methods.map((m) => {
              const badge = directionBadge(m.direction);
              return (
                <div
                  key={m.method}
                  style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
                >
                  <Link
                    to="/explore"
                    search={{ v: version, type: m.typeName }}
                    style={{
                      color: "#e2e8f0",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    {m.method}
                  </Link>
                  <span style={{ fontSize: 10, color: badge.color }} title={badge.label}>
                    {directionArrow(m.direction)}
                  </span>
                </div>
              );
            })
          ) : (
            <span style={{ fontSize: 12, color: "#64748b" }}>No methods</span>
          )}
        </div>
      ))}
    </section>
  );
}

function directionArrow(direction: "clientToServer" | "serverToClient" | "both"): string {
  return direction === "clientToServer" ? "→" : direction === "serverToClient" ? "←" : "↔";
}
