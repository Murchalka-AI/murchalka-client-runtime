import type { ClientTarget } from "./ClientTarget.js";
import type { ExtensionRuntimeMode } from "./ExtensionRuntimeMode.js";

/** Describes one immutable artifact in an authenticated extension catalog. */
export interface ExtensionCatalogEntry {
  readonly extensionId: string;
  readonly extensionVersion: string;
  readonly moduleId: string;
  readonly moduleVersion: string;
  readonly artifactId: string;
  readonly artifactDigest: `sha256:${string}`;
  readonly artifactBytes: number;
  readonly artifactUrl: string;
  readonly mode: ExtensionRuntimeMode;
  readonly targets: readonly ClientTarget[];
  readonly publisher: string;
  readonly keyId: string;
  readonly fallbackComponent: string;
}
