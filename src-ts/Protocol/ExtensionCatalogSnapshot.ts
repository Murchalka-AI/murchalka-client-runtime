import type { ExtensionCatalogEntry } from "./ExtensionCatalogEntry.js";

/** Represents one atomic revision of the active extension catalog. */
export interface ExtensionCatalogSnapshot {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly generatedAt: string;
  readonly entries: readonly ExtensionCatalogEntry[];
}
