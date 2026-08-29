import type { ComponentNode } from "../Declarative/ComponentNode.js";
import type { JsonSchema } from "../Schemas/JsonSchema.js";

/** Represents a server-authoritative declarative Agent UI document. */
export interface AgentUiDocument {
  readonly viewId: string;
  readonly version: number;
  readonly componentTree: ComponentNode;
  readonly stateSchema: JsonSchema;
  readonly initialState?: Readonly<Record<string, unknown>>;
  readonly bindings?: readonly Readonly<Record<string, unknown>>[];
  readonly actions: readonly Readonly<Record<string, unknown>>[];
  readonly validation?: readonly Readonly<Record<string, unknown>>[];
  readonly effects?: readonly Readonly<Record<string, unknown>>[];
  readonly accessibility: Readonly<Record<string, unknown>>;
  readonly localization: Readonly<Record<string, unknown>>;
  readonly expiration?: string;
  readonly expiresAt?: string;
  readonly securityContextRef: string;
}
