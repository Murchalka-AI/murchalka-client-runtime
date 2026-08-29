import type { TrustedPublisher } from "./TrustedPublisher.js";

/** Retrieves the Runtime installation's public publisher trust projection. */
export class TrustedPublisherClient {
  /** Creates a client restricted to one explicit loopback Runtime origin. */
  public constructor(private readonly runtimeOrigin: URL) {
    if (runtimeOrigin.protocol !== "http:" || !["127.0.0.1", "[::1]", "::1", "localhost"].includes(runtimeOrigin.hostname)) {
      throw new Error("Publisher trust origin must be an explicit HTTP loopback origin.");
    }
  }

  /** Retrieves ECDSA publisher public keys without credentials or redirects. */
  public async getPublishers(signal?: AbortSignal): Promise<readonly TrustedPublisher[]> {
    const request: RequestInit = { cache: "no-store", credentials: "omit", redirect: "error" };
    if (signal !== undefined) request.signal = signal;
    const response = await fetch(new URL("/client/v1/trusted-publishers", this.runtimeOrigin), request);
    if (!response.ok) throw new Error(`Publisher trust request failed with HTTP ${response.status}.`);
    const value = await response.json() as unknown;
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Publisher trust document is invalid.");
    const document = value as { readonly schemaVersion?: unknown; readonly publishers?: unknown };
    if (document.schemaVersion !== 1 || !Array.isArray(document.publishers) || document.publishers.length > 128) throw new Error("Publisher trust document is invalid.");
    return document.publishers.map(item => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) throw new Error("Publisher trust entry is invalid.");
      const entry = item as Partial<TrustedPublisher>;
      if (typeof entry.publisher !== "string" || typeof entry.keyId !== "string" || typeof entry.publicKeyPem !== "string") throw new Error("Publisher trust entry is invalid.");
      return { publisher: entry.publisher, keyId: entry.keyId, publicKeyPem: entry.publicKeyPem };
    });
  }
}
