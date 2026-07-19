// Authorization model data — the auth evolution matrix (#22) and the OAuth
// step-through dance (#21). Auth is hand-authored behavioral content, not
// schema-derived: every version since 2025-03-26 reshaped it, and the spec
// carries the model in prose + referenced RFCs/SEPs. Each claim is citation-
// anchored (spec section, RFC, SEP) and the citations are structurally
// validated so a malformed or off-domain anchor fails the build.

export type CitationKind = "spec" | "rfc" | "sep";

export interface Citation {
  kind: CitationKind;
  /** Human label, e.g. "RFC 9728", "SEP-991", "Authorization". */
  id: string;
  url: string;
}

export interface AuthFeature {
  name: string;
  detail: string;
  citations: Citation[];
}

export interface AuthVersion {
  /** Version id; the 2026-07-28 draft uses "draft" to match the data pipeline. */
  version: string;
  label: string;
  /** One-line model summary for the matrix. */
  model: string;
  features: AuthFeature[];
}

const rfc = (n: number): Citation => ({
  kind: "rfc",
  id: `RFC ${n}`,
  url: `https://datatracker.ietf.org/doc/html/rfc${n}`,
});
const sep = (n: number): Citation => ({
  kind: "sep",
  id: `SEP-${n}`,
  url: `https://github.com/modelcontextprotocol/modelcontextprotocol/issues/${n}`,
});
const spec = (version: string): Citation => ({
  kind: "spec",
  id: "Authorization",
  url: `https://modelcontextprotocol.io/specification/${version}/basic/authorization`,
});

export const AUTH_VERSIONS: AuthVersion[] = [
  {
    version: "2024-11-05",
    label: "2024-11-05",
    model: "No authorization in the spec.",
    features: [],
  },
  {
    version: "2025-03-26",
    label: "2025-03-26",
    model: "OAuth 2.1 introduced; the MCP server is both authorization and resource server.",
    features: [
      {
        name: "OAuth 2.1 (AS + RS combined)",
        detail: "The MCP server issues and validates tokens itself.",
        citations: [spec("2025-03-26")],
      },
      {
        name: "Dynamic Client Registration",
        detail: "Clients self-register at runtime.",
        citations: [rfc(7591)],
      },
      {
        name: "PKCE",
        detail: "Authorization-code flow with PKCE is mandatory.",
        citations: [rfc(7636)],
      },
      {
        name: "AS metadata discovery",
        detail: "Server advertises endpoints via metadata.",
        citations: [rfc(8414)],
      },
    ],
  },
  {
    version: "2025-06-18",
    label: "2025-06-18",
    model: "Authorization and resource servers separate; the MCP server is a pure resource server.",
    features: [
      {
        name: "AS / RS separation",
        detail: "The MCP server delegates token issuance to an external AS.",
        citations: [spec("2025-06-18")],
      },
      {
        name: "Protected Resource Metadata",
        detail: "The RS advertises its AS via .well-known metadata.",
        citations: [rfc(9728)],
      },
      {
        name: "Resource Indicators",
        detail: "Tokens are bound to the target resource.",
        citations: [rfc(8707)],
      },
    ],
  },
  {
    version: "2025-11-25",
    label: "2025-11-25",
    model: "OIDC discovery, incremental scope consent, and client ID metadata documents.",
    features: [
      {
        name: "OIDC Discovery",
        detail: "OpenID Connect discovery accepted alongside RFC 8414.",
        citations: [spec("2025-11-25")],
      },
      {
        name: "Incremental scope consent",
        detail: "Step-up authorization via WWW-Authenticate.",
        citations: [sep(835)],
      },
      {
        name: "Client ID Metadata Documents (CIMD)",
        detail: "Recommended registration mechanism.",
        citations: [sep(991)],
      },
      {
        name: ".well-known fallback",
        detail: "WWW-Authenticate optional; discovery falls back to .well-known.",
        citations: [sep(985)],
      },
    ],
  },
  {
    version: "draft",
    label: "2026-07-28 (draft)",
    model: "Issuer validation, credential binding, and refined discovery/registration.",
    features: [
      {
        name: "Issuer validation (iss)",
        detail: "Authorization responses validated per RFC 9207.",
        citations: [rfc(9207), sep(2468)],
      },
      {
        name: "application_type in DCR",
        detail: "Registration declares the client's application type.",
        citations: [sep(837)],
      },
      {
        name: "Credential issuer binding",
        detail: "Tokens bound to a credential issuer.",
        citations: [sep(2352)],
      },
      {
        name: "Refresh-token guidance",
        detail: "Explicit refresh-token handling.",
        citations: [sep(2207)],
      },
      {
        name: "Scope accumulation on step-up",
        detail: "Step-up consent accumulates granted scopes.",
        citations: [sep(2350)],
      },
    ],
  },
];

// ── OAuth step-through (#21) ─────────────────────────────────────────────────

export interface AuthActor {
  id: string;
  label: string;
}

export const AUTH_ACTORS: AuthActor[] = [
  { id: "client", label: "Client" },
  { id: "rs", label: "MCP Server (RS)" },
  { id: "as", label: "Auth Server" },
  { id: "ua", label: "User-Agent" },
];

export type AuthMessageKind = "request" | "response" | "redirect";

export interface AuthStep {
  from: string;
  to: string;
  label: string;
  kind: AuthMessageKind;
  /** The actual HTTP message (request line / status + key headers + body). */
  http: string;
  note?: string;
  citations: Citation[];
  /** Present only from this version onward (e.g. iss validation in the draft). */
  minVersion?: string;
}

export const AUTH_DANCE: AuthStep[] = [
  {
    from: "client",
    to: "rs",
    label: "unauthenticated request",
    kind: "request",
    http: "GET /mcp HTTP/1.1\nHost: mcp.example.com",
    citations: [spec("2025-11-25")],
  },
  {
    from: "rs",
    to: "client",
    label: "401 + WWW-Authenticate",
    kind: "response",
    http: 'HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer resource_metadata=\n  "https://mcp.example.com/.well-known/oauth-protected-resource"',
    note: "WWW-Authenticate is optional since 2025-11-25; clients may fall back to .well-known.",
    citations: [rfc(9728), sep(985)],
  },
  {
    from: "client",
    to: "rs",
    label: "protected resource metadata",
    kind: "request",
    http: 'GET /.well-known/oauth-protected-resource HTTP/1.1\nHost: mcp.example.com\n\n→ { authorization_servers: ["https://auth.example.com"], resource: "https://mcp.example.com" }',
    citations: [rfc(9728)],
  },
  {
    from: "client",
    to: "as",
    label: "AS discovery",
    kind: "request",
    http: "GET /.well-known/openid-configuration HTTP/1.1\nHost: auth.example.com\n\n→ { authorization_endpoint, token_endpoint, registration_endpoint, ... }",
    note: "OIDC discovery accepted alongside RFC 8414 since 2025-11-25.",
    citations: [rfc(8414)],
  },
  {
    from: "client",
    to: "as",
    label: "client registration",
    kind: "request",
    http: 'POST /register HTTP/1.1\nContent-Type: application/json\n\n{ "redirect_uris": ["myapp://cb"], "application_type": "native" }',
    note: "DCR (RFC 7591); CIMD is recommended since 2025-11-25; application_type added in the draft.",
    citations: [rfc(7591), sep(991)],
  },
  {
    from: "client",
    to: "ua",
    label: "authorization request (PKCE + resource)",
    kind: "redirect",
    http: "302 → https://auth.example.com/authorize?\n  response_type=code&code_challenge=…&code_challenge_method=S256\n  &resource=https://mcp.example.com&scope=mcp",
    citations: [rfc(7636), rfc(8707)],
  },
  {
    from: "ua",
    to: "as",
    label: "user consent",
    kind: "request",
    http: "GET /authorize?… (user authenticates and grants scopes)",
    citations: [spec("2025-11-25")],
  },
  {
    from: "as",
    to: "client",
    label: "callback + iss validation",
    kind: "redirect",
    http: "302 → myapp://cb?code=AUTH_CODE&iss=https://auth.example.com",
    note: "iss must be validated per RFC 9207 from the 2026-07-28 draft.",
    citations: [rfc(9207), sep(2468)],
    minVersion: "draft",
  },
  {
    from: "client",
    to: "as",
    label: "token exchange",
    kind: "request",
    http: 'POST /token HTTP/1.1\nContent-Type: application/x-www-form-urlencoded\n\ngrant_type=authorization_code&code=AUTH_CODE\n&code_verifier=…&resource=https://mcp.example.com\n\n→ { access_token, refresh_token, token_type: "Bearer" }',
    citations: [rfc(8707), sep(2207)],
  },
  {
    from: "client",
    to: "rs",
    label: "authenticated request",
    kind: "request",
    http: "GET /mcp HTTP/1.1\nHost: mcp.example.com\nAuthorization: Bearer ACCESS_TOKEN",
    citations: [spec("2025-11-25")],
  },
  {
    from: "rs",
    to: "client",
    label: "step-up consent (insufficient_scope)",
    kind: "response",
    http: 'HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer error="insufficient_scope",\n  scope="mcp:tools"',
    note: "Step-up re-runs authorization; granted scopes accumulate.",
    citations: [sep(835), sep(2350)],
  },
];

// ── Validation (the citation drift gate for #21/#22) ─────────────────────────

const ALLOWED_HOSTS = ["datatracker.ietf.org", "modelcontextprotocol.io", "github.com"];

export interface CitationError {
  where: string;
  id: string;
  reason: string;
}

function checkCitations(where: string, citations: Citation[]): CitationError[] {
  const errors: CitationError[] = [];
  if (citations.length === 0) errors.push({ where, id: "(none)", reason: "no citations" });
  for (const c of citations) {
    if (!c.id.trim()) errors.push({ where, id: c.id, reason: "empty id" });
    let host: string | undefined;
    try {
      host = new URL(c.url).host;
    } catch {
      errors.push({ where, id: c.id, reason: `malformed url: ${c.url}` });
      continue;
    }
    if (!ALLOWED_HOSTS.includes(host)) {
      errors.push({ where, id: c.id, reason: `off-domain host: ${host}` });
    }
  }
  return errors;
}

/** Every feature and every step must carry well-formed, on-domain citations. */
export function validateAuthCitations(): CitationError[] {
  const errors: CitationError[] = [];
  for (const v of AUTH_VERSIONS) {
    for (const f of v.features)
      errors.push(...checkCitations(`${v.version}/${f.name}`, f.citations));
  }
  for (const step of AUTH_DANCE)
    errors.push(...checkCitations(`dance/${step.label}`, step.citations));
  return errors;
}

/** The dance steps present for a version (draft-only steps drop out earlier). */
export function danceForVersion(version: string): AuthStep[] {
  const order = AUTH_VERSIONS.map((v) => v.version);
  const idx = order.indexOf(version);
  return AUTH_DANCE.filter((s) => {
    if (!s.minVersion) return true;
    return idx >= 0 && idx >= order.indexOf(s.minVersion);
  });
}
