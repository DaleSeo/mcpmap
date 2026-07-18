import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { VersionArtifact } from "../pipeline/artifact.ts";
import { diffVersions, type ChangeKind, type FieldChange, type MethodDiff } from "../lib/diff.ts";
import { classifyCapability, classifyMethod, type Role, type Severity } from "../lib/classify.ts";
import { areaColor } from "../lib/areas.ts";
import { DEFAULT_VERSION, isVersion, loadArtifact, VERSIONS } from "../lib/data.ts";

interface DiffSearch {
  before?: string;
  after?: string;
  /** Absent means the default ("client"), keeping `/diff` links param-free. */
  role?: Role;
}

const DEFAULT_BEFORE = "2025-06-18";

export const Route = createFileRoute("/diff")({
  validateSearch: (search: Record<string, unknown>): DiffSearch => ({
    before:
      typeof search.before === "string" && isVersion(search.before) ? search.before : undefined,
    after: typeof search.after === "string" && isVersion(search.after) ? search.after : undefined,
    role: search.role === "server" ? "server" : undefined,
  }),
  loaderDeps: ({ search }) => ({
    before: search.before ?? DEFAULT_BEFORE,
    after: search.after ?? DEFAULT_VERSION,
  }),
  loader: async ({ deps }) => ({
    before: await loadArtifact(deps.before),
    after: await loadArtifact(deps.after),
  }),
  component: Diff,
});

const SEVERITY_COLOR: Record<Severity, string> = {
  breaking: "#f43f5e",
  additive: "#22c55e",
  none: "#64748b",
};

const STATUS_COLOR: Record<ChangeKind, string> = {
  added: "#22c55e",
  removed: "#f43f5e",
  changed: "#f59e0b",
  unchanged: "#64748b",
};

/** method name → its feature area, preferring the newer version's clustering. */
function methodAreas(before: VersionArtifact, after: VersionArtifact) {
  const map = new Map<string, { area: string; label: string }>();
  for (const artifact of [after, before]) {
    for (const c of artifact.clusters) {
      for (const m of c.methods) if (!map.has(m)) map.set(m, { area: c.area, label: c.label });
    }
  }
  return map;
}

function Diff() {
  const { before, after } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const role: Role = search.role ?? "client";

  const diff = useMemo(() => diffVersions(before, after), [before, after]);
  const areas = useMemo(() => methodAreas(before, after), [before, after]);

  const setVersion = (which: "before" | "after", v: string) =>
    void navigate({ search: (s) => ({ ...s, [which]: v }) });
  const setRole = (r: Role) => void navigate({ search: (s) => ({ ...s, role: r }) });

  // Group the non-trivial method changes by feature area, in the clustering's order.
  const grouped = useMemo(() => {
    const changed = diff.methods.filter((m) => m.status !== "unchanged");
    const byArea = new Map<string, { label: string; methods: MethodDiff[] }>();
    for (const m of changed) {
      const a = areas.get(m.method) ?? { area: "common", label: "Common" };
      const bucket = byArea.get(a.area) ?? { label: a.label, methods: [] };
      bucket.methods.push(m);
      byArea.set(a.area, bucket);
    }
    // Order areas by the after-version cluster order for stability.
    const order = [...new Set([...after.clusters, ...before.clusters].map((c) => c.area))];
    return order.filter((area) => byArea.has(area)).map((area) => ({ area, ...byArea.get(area)! }));
  }, [diff, areas, before, after]);

  const capChanges = diff.capabilities.filter((c) => c.status !== "unchanged");

  const counts = useMemo(() => {
    let added = 0,
      removed = 0,
      changed = 0,
      breaking = 0;
    for (const m of diff.methods) {
      if (m.status === "added") added++;
      else if (m.status === "removed") removed++;
      else if (m.status === "changed") changed++;
      if (classifyMethod(m)[role] === "breaking") breaking++;
    }
    return { added, removed, changed, breaking };
  }, [diff, role]);

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
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Version diff</h1>
        <Link to="/explore" search={{}} style={{ color: "#0ea5e9", fontSize: 13 }}>
          Type explorer →
        </Link>
        <Link to="/capabilities" search={{}} style={{ color: "#0ea5e9", fontSize: 13 }}>
          Capabilities →
        </Link>
      </header>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <VersionPicker
          label="From"
          value={before.version}
          onChange={(v) => setVersion("before", v)}
        />
        <span style={{ color: "#64748b" }}>→</span>
        <VersionPicker label="To" value={after.version} onChange={(v) => setVersion("after", v)} />

        <div
          style={{
            display: "flex",
            gap: 0,
            marginLeft: 8,
            border: "1px solid #1e293b",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <RoleButton active={role === "client"} onClick={() => setRole("client")}>
            I build a client
          </RoleButton>
          <RoleButton active={role === "server"} onClick={() => setRole("server")}>
            I build a server
          </RoleButton>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 20px" }}>
        <Stat n={counts.added} label="added" color={STATUS_COLOR.added} />
        {" · "}
        <Stat n={counts.removed} label="removed" color={STATUS_COLOR.removed} />
        {" · "}
        <Stat n={counts.changed} label="changed" color={STATUS_COLOR.changed} />
        {" · "}
        <Stat n={counts.breaking} label={`breaking for ${role}s`} color={SEVERITY_COLOR.breaking} />
        {diff.reorganizations.length > 0 ? (
          <>
            {" "}
            {" · "}
            <span style={{ color: "#64748b" }}>
              {diff.reorganizations.length} internal renames (not wire changes)
            </span>
          </>
        ) : null}
      </p>

      {capChanges.length > 0 ? (
        <section style={{ marginBottom: 24 }}>
          <SectionHeading>Capabilities</SectionHeading>
          {capChanges.map((c) => (
            <div
              key={`${c.side}-${c.name}`}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 4,
                fontSize: 13,
              }}
            >
              <StatusTag status={c.status} />
              <code style={{ fontFamily: "ui-monospace, monospace" }}>
                {c.side}.{c.name}
              </code>
              <SeverityTag severity={classifyCapability(c)[role]} />
            </div>
          ))}
        </section>
      ) : null}

      {grouped.map(({ area, label, methods }) => (
        <section key={area} style={{ marginBottom: 24 }}>
          <SectionHeading accent={areaColor(area)}>{label}</SectionHeading>
          {methods.map((m) => (
            <MethodRow key={m.method} diff={m} role={role} />
          ))}
        </section>
      ))}

      {grouped.length === 0 && capChanges.length === 0 ? (
        <p style={{ color: "#64748b" }}>No wire-level differences between these versions.</p>
      ) : null}
    </main>
  );
}

function MethodRow({ diff, role }: { diff: MethodDiff; role: Role }) {
  const severity = classifyMethod(diff)[role];
  const border = severity === "breaking" ? SEVERITY_COLOR.breaking : "#1e293b";
  const fields = [
    ...diff.params.fields.map((f) => ({ ...f, at: "params" })),
    ...diff.result.fields.map((f) => ({ ...f, at: "result" })),
  ];

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <StatusTag status={diff.status} />
        <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>{diff.method}</code>
        <SeverityTag severity={severity} />
      </div>
      {fields.length > 0 ? (
        <div style={{ marginTop: 8, display: "grid", gap: 3 }}>
          {fields.map((f) => (
            <FieldRow key={`${f.at}.${f.name}`} field={f} at={f.at} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FieldRow({ field, at }: { field: FieldChange; at: string }) {
  const detail =
    field.status === "changed" && field.typeBefore
      ? field.typeBefore === field.typeAfter && field.requiredBefore !== field.requiredAfter
        ? `${field.requiredBefore ? "required" : "optional"} → ${field.requiredAfter ? "required" : "optional"}`
        : field.typeBefore !== field.typeAfter
          ? `${field.typeBefore} → ${field.typeAfter}`
          : "shape changed"
      : field.status === "added" || field.status === "removed"
        ? (field.requiredAfter ?? field.requiredBefore)
          ? "required"
          : "optional"
        : "";
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        fontSize: 12,
        color: "#cbd5e1",
        fontFamily: "ui-monospace, monospace",
      }}
    >
      <span style={{ color: STATUS_COLOR[field.status], width: 62, flexShrink: 0 }}>
        {field.status}
      </span>
      <span style={{ color: "#64748b", width: 52, flexShrink: 0 }}>{at}</span>
      <span>{field.name}</span>
      {detail ? <span style={{ color: "#64748b" }}>· {detail}</span> : null}
    </div>
  );
}

function VersionPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ fontSize: 12, color: "#94a3b8" }}>
      {label}{" "}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
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
  );
}

function RoleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        fontSize: 13,
        border: "none",
        background: active ? "#1e293b" : "transparent",
        color: active ? "#e2e8f0" : "#94a3b8",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span>
      <strong style={{ color }}>{n}</strong> {label}
    </span>
  );
}

function StatusTag({ status }: { status: ChangeKind }) {
  return (
    <span
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        color: STATUS_COLOR[status],
        border: `1px solid ${STATUS_COLOR[status]}`,
        borderRadius: 4,
        padding: "1px 5px",
      }}
    >
      {status}
    </span>
  );
}

function SeverityTag({ severity }: { severity: Severity }) {
  if (severity === "none") return null;
  return (
    <span
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        color: SEVERITY_COLOR[severity],
        marginLeft: "auto",
      }}
    >
      {severity}
    </span>
  );
}

function SectionHeading({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <h2 style={{ fontSize: 13, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
      {accent ? (
        <span style={{ width: 10, height: 10, borderRadius: 2, background: accent }} />
      ) : null}
      {children}
    </h2>
  );
}
