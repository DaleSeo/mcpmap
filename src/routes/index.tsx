import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

const PATHS = [
  {
    audience: "New to MCP",
    blurb:
      "See the shape of the protocol — types clustered by feature area, one click to a type's neighborhood.",
    to: "/explore" as const,
    cta: "Explore the type graph",
  },
  {
    audience: "Building a server or client",
    blurb:
      "Walk the canonical message flows with real typed payloads, and the full OAuth dance step by step.",
    to: "/flows" as const,
    cta: "Walk the message flows",
  },
  {
    audience: "Implementing the protocol",
    blurb:
      "Diff any two versions with directional breaking-change analysis for client and server implementers.",
    to: "/diff" as const,
    cta: "Diff any two versions",
  },
];

function Home() {
  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        color: "#e2e8f0",
        background: "#020617",
        minHeight: "100dvh",
      }}
    >
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "72px 24px 48px" }}>
        <p
          style={{
            fontSize: 13,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#0ea5e9",
            margin: "0 0 12px",
          }}
        >
          mcpmap
        </p>
        <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: "0 0 16px", fontWeight: 800 }}>
          A visual map of the Model Context Protocol spec.
        </h1>
        <p style={{ fontSize: 17, color: "#94a3b8", maxWidth: 620, margin: "0 0 28px" }}>
          Interactive type explorer, message flows, version diffs, and the authorization model — all
          generated from the official MCP schema, so they can&rsquo;t drift.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 56 }}>
          <Link to="/diff" search={{}} style={primaryCta}>
            See what changed in 2026-07-28 →
          </Link>
          <Link to="/explore" search={{}} style={secondaryCta}>
            Open the type explorer
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {PATHS.map((p) => (
            <Link
              key={p.audience}
              to={p.to}
              search={{}}
              style={{
                display: "block",
                border: "1px solid #1e293b",
                borderRadius: 12,
                padding: 18,
                textDecoration: "none",
                color: "inherit",
                background: "#0b1120",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "#0ea5e9",
                  marginBottom: 8,
                }}
              >
                {p.audience}
              </div>
              <p style={{ fontSize: 14, color: "#cbd5e1", margin: "0 0 12px", lineHeight: 1.5 }}>
                {p.blurb}
              </p>
              <span style={{ fontSize: 13, color: "#0ea5e9" }}>{p.cta} →</span>
            </Link>
          ))}
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid #1e293b",
          padding: "24px",
          maxWidth: 880,
          margin: "0 auto",
          fontSize: 12,
          color: "#64748b",
        }}
      >
        <p style={{ margin: "0 0 8px" }}>
          Unofficial, community-built, and not affiliated with the Model Context Protocol project.
          Generated from the public schema for reference only — the specification is authoritative.
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noreferrer"
            style={footerLink}
          >
            Official docs
          </a>
          <a
            href="https://spec.modelcontextprotocol.io"
            target="_blank"
            rel="noreferrer"
            style={footerLink}
          >
            Specification
          </a>
          <a
            href="https://github.com/modelcontextprotocol/modelcontextprotocol"
            target="_blank"
            rel="noreferrer"
            style={footerLink}
          >
            Schema source
          </a>
          <a
            href="https://github.com/DaleSeo/mcpmap"
            target="_blank"
            rel="noreferrer"
            style={footerLink}
          >
            mcpmap on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

const primaryCta: React.CSSProperties = {
  background: "#0ea5e9",
  color: "#020617",
  fontWeight: 600,
  fontSize: 14,
  padding: "10px 16px",
  borderRadius: 8,
  textDecoration: "none",
};

const secondaryCta: React.CSSProperties = {
  border: "1px solid #334155",
  color: "#e2e8f0",
  fontSize: 14,
  padding: "10px 16px",
  borderRadius: 8,
  textDecoration: "none",
};

const footerLink: React.CSSProperties = { color: "#94a3b8", textDecoration: "none" };
