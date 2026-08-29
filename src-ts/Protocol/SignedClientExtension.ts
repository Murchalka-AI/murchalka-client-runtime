import type { ClientExtension } from "./ClientExtension.js";
import type { ExtensionSignature } from "./ExtensionSignature.js";

/** Wraps an extension document with a detached publisher signature. */
export interface SignedClientExtension {
  readonly schemaVersion: 1;
  readonly extension: ClientExtension;
  readonly signature: ExtensionSignature;
}
