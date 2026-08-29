import type { ComponentNode } from "./ComponentNode.js";
import type { ClientSecurityPolicy } from "../Security/ClientSecurityPolicy.js";

/** Validates declarative trees without interpreting module-provided markup. */
export class ComponentTreeValidator {
  /** Validates component kinds, depth, node count, and serializable properties. */
  public validate(root: ComponentNode, policy: ClientSecurityPolicy): void {
    let count = 0;
    const identifiers = new Set<string>();
    const components = new Set(["standard.layout", "standard.text", "standard.media", "standard.form", "standard.list", "standard.action", "extension-host"]);
    const visit = (node: ComponentNode, depth: number): void => {
      count += 1;
      if (typeof node !== "object" || node === null || !components.has(node.component)) throw new Error("Extension component kind is unsupported.");
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
      node.children?.forEach(child => visit(child, depth + 1));
    };
    visit(root, 1);
  }
}
