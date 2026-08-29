import type { ActivatedExtension } from "./ActivatedExtension.js";

/** Represents one atomically activated client registry revision. */
export interface ExtensionRegistrySnapshot {
  readonly revision: number;
  readonly extensions: readonly ActivatedExtension[];
}
