// Upstream source of truth: the official MCP specification repository.
// The schema is defined TypeScript-first and mirrored as JSON Schema; we consume
// the JSON Schema (`schema.json`) because it carries both structure and the
// `description` docs, and is far simpler to parse than `schema.ts`.

export const REPO_OWNER = "modelcontextprotocol";
export const REPO_NAME = "modelcontextprotocol";
export const DEFAULT_BRANCH = "main";

/** Directory in the repo holding one subdirectory per protocol version. */
export const SCHEMA_DIR = "schema";

/** The schema file we ingest from each version directory. */
export const SCHEMA_FILE = "schema.json";

export const GITHUB_API = "https://api.github.com";

/** Raw file contents at a pinned commit. */
export function rawUrl(commit: string, path: string): string {
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${commit}/${path}`;
}

/** GitHub contents API for a path at a ref (used to discover version dirs). */
export function contentsUrl(path: string, ref: string): string {
  return `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${ref}`;
}

/** Resolve the current commit SHA of a branch. */
export function branchUrl(branch: string): string {
  return `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/commits/${branch}`;
}

/** GitHub API request headers; picks up GITHUB_TOKEN when available (CI). */
export function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "mcpmap-pipeline",
  };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
