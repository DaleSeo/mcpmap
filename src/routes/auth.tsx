import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AUTH_ACTORS,
  AUTH_VERSIONS,
  danceForVersion,
  type AuthStep,
  type Citation,
} from "../lib/auth.ts";
import { FlowDiagram, type SequenceStep } from "../components/FlowDiagram.tsx";

interface AuthSearch {
  v?: string;
  step?: number;
}

const DEFAULT_AUTH_VERSION = "2025-11-25";
/** Versions with a full step-through; earlier ones are matrix-only. */
const STEP_THROUGH = new Set(["2025-11-25", "draft"]);

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    v:
      typeof search.v === "string" && AUTH_VERSIONS.some((a) => a.version === search.v)
        ? search.v
        : undefined,
    step: typeof search.step === "number" ? search.step : undefined,
  }),
  component: Auth,
});

const CITATION_COLOR: Record<Citation["kind"], string> = {
  spec: "#0ea5e9",
  rfc: "#22c55e",
  sep: "#a855f7",
};

const MESSAGE_OF: Record<AuthStep["kind"], SequenceStep["message"]> = {
  request: "request",
  response: "result",
  redirect: "notification",
};

function Auth() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const version = search.v ?? DEFAULT_AUTH_VERSION;
  const authVersion = AUTH_VERSIONS.find((a) => a.version === version)!;

  const dance = useMemo(() => danceForVersion(version), [version]);
  const steps: SequenceStep[] = dance.map((s) => ({
    from: s.from,
    to: s.to,
    label: s.label,
    message: MESSAGE_OF[s.kind],
  }));
  const selected =
    typeof search.step === "number" && search.step < dance.length ? search.step : null;

  const setVersion = (v: string) =>
    void navigate({
      search: (s) => ({ ...s, v: v === DEFAULT_AUTH_VERSION ? undefined : v, step: undefined }),
    });
  const setStep = (i: number) => void navigate({ search: (s) => ({ ...s, step: i }) });

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
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Authorization</h1>
        <Link to="/explore" search={{}} style={{ color: "#0ea5e9", fontSize: 13 }}>
          Type explorer →
        </Link>
        <Link to="/flows" search={{}} style={{ color: "#0ea5e9", fontSize: 13 }}>
          Message flows →
        </Link>
      </header>
      <p style={{ fontSize: 13, color: "#94a3b8", maxWidth: 680, margin: "0 0 20px" }}>
        The most version-divergent area of the spec. Below: the auth model per version (the
        evolution matrix), then a step-through of the OAuth dance for the selected version. Every
        claim is cited.
      </p>

      {/* #22 — evolution matrix */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>Auth evolution matrix</SectionHeading>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <tbody>
              {AUTH_VERSIONS.map((a) => {
                const active = a.version === version;
                return (
                  <tr
                    key={a.version}
                    style={{
                      borderTop: "1px solid #1e293b",
                      background: active ? "#0b1120" : "transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        verticalAlign: "top",
                        whiteSpace: "nowrap",
                        width: 1,
                      }}
                    >
                      <button
                        onClick={() => setVersion(a.version)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: active ? "#0ea5e9" : "#e2e8f0",
                          fontWeight: active ? 700 : 500,
                          fontSize: 13,
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {a.label}
                      </button>
                    </td>
                    <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                      <div style={{ color: "#cbd5e1", marginBottom: a.features.length ? 6 : 0 }}>
                        {a.model}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {a.features.map((f) => (
                          <span
                            key={f.name}
                            title={f.detail}
                            style={{
                              display: "inline-flex",
                              gap: 6,
                              alignItems: "center",
                              border: "1px solid #1e293b",
                              borderRadius: 6,
                              padding: "2px 8px",
                              fontSize: 12,
                            }}
                          >
                            {f.name}
                            {f.citations.map((c) => (
                              <CitationChip key={c.id} c={c} />
                            ))}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* #21 — step-through */}
      <section>
        <SectionHeading>OAuth dance · {authVersion.label}</SectionHeading>
        {STEP_THROUGH.has(version) ? (
          <>
            <div
              style={{
                overflowX: "auto",
                border: "1px solid #1e293b",
                borderRadius: 10,
                padding: 8,
                marginBottom: 16,
              }}
            >
              <FlowDiagram
                actors={AUTH_ACTORS}
                steps={steps}
                selected={selected}
                onSelect={setStep}
              />
            </div>
            {selected !== null ? (
              <StepDetail step={dance[selected]!} />
            ) : (
              <p style={{ color: "#64748b", fontSize: 13 }}>
                Click a step to see its HTTP message and citations.
              </p>
            )}
          </>
        ) : version === "2024-11-05" ? (
          <p style={{ color: "#64748b" }}>
            2024-11-05 has no authorization model — the step-through begins at 2025-03-26.
          </p>
        ) : (
          <p style={{ color: "#64748b" }}>
            The interactive step-through covers the two latest versions. Select 2025-11-25 or the
            2026-07-28 draft; the matrix above shows {authVersion.label}'s model.
          </p>
        )}
      </section>
    </main>
  );
}

function StepDetail({ step }: { step: AuthStep }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#94a3b8",
          margin: "0 0 8px",
        }}
      >
        {step.label}
      </h3>
      <pre
        style={{
          margin: "0 0 10px",
          padding: 14,
          borderRadius: 8,
          background: "#0b1120",
          border: "1px solid #1e293b",
          overflowX: "auto",
          fontSize: 12,
          fontFamily: "ui-monospace, monospace",
          color: "#e2e8f0",
          whiteSpace: "pre-wrap",
        }}
      >
        {step.http}
      </pre>
      {step.note ? (
        <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 8px" }}>{step.note}</p>
      ) : null}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {step.citations.map((c) => (
          <CitationChip key={c.id} c={c} withLabel />
        ))}
      </div>
    </div>
  );
}

function CitationChip({ c, withLabel }: { c: Citation; withLabel?: boolean }) {
  return (
    <a
      href={c.url}
      target="_blank"
      rel="noreferrer"
      title={`${c.id} (${c.kind})`}
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        color: CITATION_COLOR[c.kind],
        border: `1px solid ${CITATION_COLOR[c.kind]}`,
        borderRadius: 4,
        padding: "1px 5px",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {withLabel
        ? c.id
        : c.id.replace(/^(RFC|SEP-)\s?/, (m) => (m.startsWith("RFC") ? "RFC " : "SEP-"))}
    </a>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 13, margin: "0 0 12px", color: "#e2e8f0" }}>{children}</h2>;
}
