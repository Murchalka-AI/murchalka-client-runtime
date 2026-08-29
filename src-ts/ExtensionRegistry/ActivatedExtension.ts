import type { ClientExtension } from "../Protocol/ClientExtension.js";

/** Represents one verified extension or an accessible unsupported-target fallback. */
export interface ActivatedExtension {
  readonly extension: ClientExtension;
  readonly artifactDigest: string;
  readonly publisher: string;
  readonly isFallback: boolean;
  readonly activatedAt: string;
}
