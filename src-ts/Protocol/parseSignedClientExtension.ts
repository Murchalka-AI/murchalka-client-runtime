import type { ClientExtension } from "./ClientExtension.js";
import type { SignedClientExtension } from "./SignedClientExtension.js";

/** Parses a bounded JSON artifact and rejects structural ambiguity. */
export function parseSignedClientExtension(bytes: Uint8Array): SignedClientExtension {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error("Extension artifact is not valid UTF-8 JSON.");
  }
  const root = asRecord(value, "extension envelope");
  exactKeys(root, ["schemaVersion", "extension", "signature"], "extension envelope");
  if (root.schemaVersion !== 1) throw new Error("Extension envelope schema version is unsupported.");
  const extension = asRecord(root.extension, "extension");
  const signature = asRecord(root.signature, "extension signature");
  if (signature.algorithm !== "ecdsa-p256-sha256" || typeof signature.keyId !== "string" || typeof signature.value !== "string") {
    throw new Error("Extension signature metadata is invalid.");
  }
  if (extension.apiVersion !== "client.murchalka.dev/v1" || extension.kind !== "ClientExtension" ||
      typeof extension.id !== "string" || typeof extension.version !== "string" || !Array.isArray(extension.targets) ||
      (extension.mode !== "declarative" && extension.mode !== "wasm") || !Array.isArray(extension.actions) ||
      typeof extension.fallbackComponent !== "string" || typeof extension.propertiesSchemaVersion !== "number" ||
      typeof extension.eventsSchemaVersion !== "number") {
    throw new Error("Extension document metadata is invalid.");
  }
  asRecord(extension.componentTree, "component tree");
  asRecord(extension.accessibility, "accessibility metadata");
  asRecord(extension.localization, "localization metadata");
  if (extension.componentDefinitions !== undefined) {
    if (!Array.isArray(extension.componentDefinitions) || extension.componentDefinitions.length > 32) throw new Error("Custom component definitions are invalid.");
    for (const value of extension.componentDefinitions) {
      const definition = asRecord(value, "custom component definition");
      if (typeof definition.id !== "string" || typeof definition.version !== "number" ||
          typeof definition.propertiesSchemaVersion !== "number" || typeof definition.eventsSchemaVersion !== "number") {
        throw new Error("Custom component definition metadata is invalid.");
      }
      asRecord(definition.propertiesSchema, "custom component properties schema");
      asRecord(definition.eventsSchema, "custom component events schema");
      asRecord(definition.template, "custom component template");
    }
  }
  return { schemaVersion: 1, extension: extension as unknown as ClientExtension, signature: {
    algorithm: "ecdsa-p256-sha256",
    keyId: signature.keyId,
    value: signature.value,
  } };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (actual.length !== allowed.length || actual.some((key, index) => key !== allowed[index])) throw new Error(`${label} contains unknown fields.`);
}
