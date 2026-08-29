import { ComponentTreeValidator } from "../Declarative/ComponentTreeValidator.js";
import type { ClientSecurityPolicy } from "../Security/ClientSecurityPolicy.js";
import { JsonSchemaValidator } from "../Schemas/JsonSchemaValidator.js";
import type { AgentUiDocument } from "./AgentUiDocument.js";
import type { AgentUiSnapshot } from "./AgentUiSnapshot.js";

/** Validates and activates server-authoritative Agent UI documents. */
export class AgentUiRuntime {
  private readonly schemas = new JsonSchemaValidator();
  private readonly components = new ComponentTreeValidator();
  private current: AgentUiSnapshot | undefined;

  /** Creates an Agent UI runtime using the shared client resource policy. */
  public constructor(private readonly policy: ClientSecurityPolicy) {}

  /** Parses, validates, and atomically activates one Agent UI document. */
  public activate(value: unknown, expectedSecurityContext?: string): AgentUiSnapshot {
    const document = this.parse(value);
    if (expectedSecurityContext !== undefined && document.securityContextRef !== expectedSecurityContext) throw new Error("Agent UI security context does not match the authenticated session.");
    const expiration = document.expiration ?? document.expiresAt;
    if (expiration === undefined || !Number.isFinite(Date.parse(expiration)) || Date.parse(expiration) <= Date.now()) throw new Error("Agent UI document is expired or has an invalid expiration.");
    this.components.validate(document.componentTree, this.policy, []);
    const state = Object.freeze({ ...(document.initialState ?? {}) });
    this.schemas.validate(state, document.stateSchema, "Agent UI state");
    const snapshot = Object.freeze({ document, state });
    this.current = snapshot;
    return snapshot;
  }

  /** Gets the last completely validated Agent UI snapshot. */
  public snapshot(): AgentUiSnapshot | undefined {
    return this.current;
  }

  private parse(value: unknown): AgentUiDocument {
    const document = this.record(value, "Agent UI document");
    const expiration = document.expiration;
    const expiresAt = document.expiresAt;
    if (typeof document.viewId !== "string" || !/^[a-z][a-z0-9]*(?:[.-][a-z][a-z0-9-]*)+$/.test(document.viewId) ||
        !Number.isSafeInteger(document.version) || (document.version as number) < 1 || !Array.isArray(document.actions) || document.actions.length > 64 ||
        typeof document.securityContextRef !== "string" || document.securityContextRef.length === 0 || document.securityContextRef.length > 256 ||
        (typeof expiration !== "string" && typeof expiresAt !== "string") || (expiration !== undefined && expiresAt !== undefined)) {
      throw new Error("Agent UI document metadata is invalid.");
    }
    this.record(document.componentTree, "Agent UI component tree");
    this.record(document.stateSchema, "Agent UI state schema");
    this.record(document.accessibility, "Agent UI accessibility metadata");
    this.record(document.localization, "Agent UI localization metadata");
    if (document.initialState !== undefined) this.record(document.initialState, "Agent UI initial state");
    for (const action of document.actions) this.record(action, "Agent UI action");
    return document as unknown as AgentUiDocument;
  }

  private record(value: unknown, label: string): Readonly<Record<string, unknown>> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
    return value as Readonly<Record<string, unknown>>;
  }
}
