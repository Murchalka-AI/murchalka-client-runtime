import type { ComponentNode } from "./ComponentNode.js";
import type { ClientSecurityPolicy } from "../Security/ClientSecurityPolicy.js";
import type { CustomComponentDefinition } from "./CustomComponentDefinition.js";
import { JsonSchemaValidator } from "../Schemas/JsonSchemaValidator.js";

/** Validates declarative trees without interpreting module-provided markup. */
export class ComponentTreeValidator {
  private readonly schemas = new JsonSchemaValidator();

  /** Validates component kinds, depth, node count, and serializable properties. */
  public validate(root: ComponentNode, policy: ClientSecurityPolicy, definitions: readonly CustomComponentDefinition[] = []): void {
    let count = 0;
    const identifiers = new Set<string>();
    const standard = new Set(["standard.document", "standard.layout", "standard.text", "standard.media", "standard.form", "standard.list", "standard.action", "extension-host"]);
    const custom = new Map<string, CustomComponentDefinition>();
    for (const definition of definitions) {
      if (!/^[a-z][a-z0-9]*(?:[.-][a-z][a-z0-9-]*)+$/.test(definition.id) || custom.has(definition.id) ||
          !Number.isSafeInteger(definition.version) || definition.version < 1 ||
          !Number.isSafeInteger(definition.propertiesSchemaVersion) || definition.propertiesSchemaVersion < 1 ||
          !Number.isSafeInteger(definition.eventsSchemaVersion) || definition.eventsSchemaVersion < 1) {
        throw new Error("Custom component definition is invalid or duplicated.");
      }
      custom.set(definition.id, definition);
    }
    const visit = (node: ComponentNode, depth: number, template: boolean): void => {
      count += 1;
      if (typeof node !== "object" || node === null || typeof node.component !== "string" || (!standard.has(node.component) && (!custom.has(node.component) || template))) throw new Error("Extension component kind is unsupported.");
      if (count > policy.maximumComponentNodes) throw new Error("Extension component tree exceeds the node limit.");
      if (depth > policy.maximumComponentDepth) throw new Error("Extension component tree exceeds the depth limit.");
      if (node.id !== undefined) {
        if (!/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(node.id) || identifiers.has(node.id)) throw new Error("Extension component identifier is invalid or duplicated.");
        identifiers.add(node.id);
      }
      if (node.properties !== undefined) {
        const encoded = new TextEncoder().encode(JSON.stringify(node.properties));
        if (encoded.byteLength > policy.maximumPayloadBytes) throw new Error("Component properties exceed the payload limit.");
      }
      const definition = custom.get(node.component);
      if (definition !== undefined) this.schemas.validate(node.properties ?? {}, definition.propertiesSchema, `${definition.id} properties`);
      node.children?.forEach(child => visit(child, depth + 1, template));
    };
    for (const definition of custom.values()) visit(definition.template, 1, true);
    visit(root, 1, false);
  }
}
