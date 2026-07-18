// Version artifact loading. The pipeline emits one JSON file per version into
// src/data; this maps a version id to its artifact via a lazy glob, so each
// version is a separate chunk fetched only when viewed.

import type { VersionArtifact } from "../pipeline/artifact.ts";

const loaders = import.meta.glob<{ default: VersionArtifact }>("../data/*.json");

/** Default version the explorer opens on — the latest finalized spec. */
export const DEFAULT_VERSION = "2025-11-25";

export async function loadArtifact(version: string): Promise<VersionArtifact> {
  const loader = loaders[`../data/${version}.json`];
  if (!loader) throw new Error(`No artifact for version "${version}"`);
  return (await loader()).default;
}
