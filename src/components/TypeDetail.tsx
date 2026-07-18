// The type detail panel: shown when a type is focused. Lists its fields with
// types and doc comments, a generated JSON example, and a link to the type in
// the official spec's schema reference.

import type { TypeNode } from "../pipeline/ir/types.ts";
import { exampleFor, formatType, objectFields, schemaReferenceUrl } from "../lib/typeref.ts";

export function TypeDetail({
  type,
  version,
  accent,
  lookup,
  onSelectType,
}: {
  type: TypeNode;
  version: string;
  accent: string;
  lookup: (name: string) => TypeNode | undefined;
  /** Follow a field's referenced type — keeps navigation inside the panel. */
  onSelectType: (name: string) => void;
}) {
  const fields = objectFields(type.shape);
  const example = exampleFor(type.shape, lookup);

  return (
    <aside
      style={{
        width: 340,
        flexShrink: 0,
        borderLeft: "1px solid #1e293b",
        padding: 16,
        overflowY: "auto",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{type.name}</span>
        <span
          style={{
            fontSize: 11,
            color: accent,
            border: `1px solid ${accent}`,
            borderRadius: 4,
            padding: "1px 6px",
          }}
        >
          {type.kind}
        </span>
      </div>

      {type.description ? (
        <p style={{ color: "#cbd5e1", margin: "0 0 12px" }}>{type.description}</p>
      ) : null}

      <a
        href={schemaReferenceUrl(version, type.name)}
        target="_blank"
        rel="noreferrer"
        style={{ color: accent, fontSize: 12 }}
      >
        Official schema reference ↗
      </a>

      {fields && fields.length > 0 ? (
        <section style={{ marginTop: 16 }}>
          <h2 style={sectionHeading}>Fields</h2>
          {fields.map((f) => {
            const ref = f.type.kind === "ref" ? f.type.name : undefined;
            return (
              <div key={f.name} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                  <span style={{ color: "#e2e8f0" }}>{f.name}</span>
                  {f.required ? null : <span style={{ color: "#64748b" }}>?</span>}
                  <span style={{ color: "#64748b" }}>: </span>
                  {ref ? (
                    <button onClick={() => onSelectType(ref)} style={refButton(accent)}>
                      {ref}
                    </button>
                  ) : (
                    <span style={{ color: accent }}>{formatType(f.type)}</span>
                  )}
                </div>
                {f.description ? (
                  <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                    {f.description}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : (
        <section style={{ marginTop: 16 }}>
          <h2 style={sectionHeading}>Type</h2>
          <code style={{ fontFamily: "ui-monospace, monospace", color: accent }}>
            {formatType(type.shape)}
          </code>
        </section>
      )}

      <section style={{ marginTop: 16 }}>
        <h2 style={sectionHeading}>Example</h2>
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 6,
            background: "#0b1120",
            border: "1px solid #1e293b",
            overflowX: "auto",
            fontSize: 12,
            fontFamily: "ui-monospace, monospace",
            color: "#e2e8f0",
          }}
        >
          {JSON.stringify(example, null, 2)}
        </pre>
      </section>
    </aside>
  );
}

const sectionHeading: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#94a3b8",
  margin: "0 0 8px",
};

function refButton(accent: string): React.CSSProperties {
  return {
    background: "none",
    border: "none",
    padding: 0,
    font: "inherit",
    color: accent,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 2,
  };
}
