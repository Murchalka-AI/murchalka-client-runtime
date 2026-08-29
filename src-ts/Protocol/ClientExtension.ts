import type { ClientActionDefinition } from "../Actions/ClientActionDefinition.js";
import type { ComponentNode } from "../Declarative/ComponentNode.js";
import type { AccessibilityMetadata } from "./AccessibilityMetadata.js";
import type { ClientTarget } from "./ClientTarget.js";
import type { ExtensionRuntimeMode } from "./ExtensionRuntimeMode.js";
import type { LocalizationMetadata } from "./LocalizationMetadata.js";
import type { CustomComponentDefinition } from "../Declarative/CustomComponentDefinition.js";

/** Defines the signed, product-agnostic payload activated by the Client Runtime. */
export interface ClientExtension {
  readonly apiVersion: "client.murchalka.dev/v1";
  readonly kind: "ClientExtension";
  readonly id: string;
  readonly version: string;
  readonly targets: readonly ClientTarget[];
  readonly mode: ExtensionRuntimeMode;
  readonly componentDefinitions?: readonly CustomComponentDefinition[];
  readonly componentTree: ComponentNode;
  readonly actions: readonly ClientActionDefinition[];
  readonly accessibility: AccessibilityMetadata;
  readonly localization: LocalizationMetadata;
  readonly fallbackComponent: string;
  readonly expiresAt?: string;
  readonly wasmBase64?: string;
  readonly propertiesSchemaVersion: number;
  readonly eventsSchemaVersion: number;
}
