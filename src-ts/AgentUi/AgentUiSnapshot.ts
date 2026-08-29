import type { AgentUiDocument } from "./AgentUiDocument.js";

/** Stores the last validated Agent UI document and immutable initial state. */
export interface AgentUiSnapshot {
  readonly document: AgentUiDocument;
  readonly state: Readonly<Record<string, unknown>>;
}
