import type { ArtifactFetcher } from "./Assets/ArtifactFetcher.js";
import type { ClientActionTransport } from "./Actions/ClientActionTransport.js";
import type { ClientTarget } from "./Protocol/ClientTarget.js";
import type { ClientSecurityPolicy } from "./Security/ClientSecurityPolicy.js";
import type { TrustedPublisher } from "./Security/TrustedPublisher.js";
import type { VerifiedExtensionCache } from "./Offline/VerifiedExtensionCache.js";

/** Defines the trusted shell dependencies for one Client Runtime instance. */
export interface ClientRuntimeOptions {
  readonly target: ClientTarget;
  readonly artifactFetcher: ArtifactFetcher;
  readonly artifactCache: VerifiedExtensionCache;
  readonly trustedPublishers: readonly TrustedPublisher[];
  readonly actionTransport: ClientActionTransport;
  readonly securityPolicy: ClientSecurityPolicy;
}
