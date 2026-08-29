import type { ExtensionCatalogSnapshot } from "../Protocol/ExtensionCatalogSnapshot.js";
import type { ClientSecurityPolicy } from "../Security/ClientSecurityPolicy.js";

/** Retrieves atomic catalog snapshots and revision notifications from loopback Runtime. */
export class ExtensionCatalogClient {
  /** Creates a catalog client restricted to one Runtime origin. */
  public constructor(
    private readonly runtimeOrigin: URL,
    private readonly policy: ClientSecurityPolicy,
  ) {
    if (runtimeOrigin.protocol !== "http:" || !["127.0.0.1", "[::1]", "::1", "localhost"].includes(runtimeOrigin.hostname)) {
      throw new Error("Extension catalog origin must be an explicit HTTP loopback origin.");
    }
  }

  /** Fetches and structurally validates the latest catalog revision. */
  public async getSnapshot(signal?: AbortSignal): Promise<ExtensionCatalogSnapshot> {
    const request: RequestInit = {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    };
    if (signal !== undefined) request.signal = signal;
    const response = await fetch(new URL("/client/v1/catalog", this.runtimeOrigin), request);
    if (!response.ok) throw new Error(`Extension catalog request failed with HTTP ${response.status}.`);
    const value = await response.json() as unknown;
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Extension catalog is invalid.");
    const snapshot = value as Partial<ExtensionCatalogSnapshot>;
    if (snapshot.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.revision) || snapshot.revision! < 0 ||
        typeof snapshot.generatedAt !== "string" || !Array.isArray(snapshot.entries) || snapshot.entries.length > this.policy.maximumCatalogEntries) {
      throw new Error("Extension catalog metadata is invalid.");
    }
    return snapshot as ExtensionCatalogSnapshot;
  }

  /** Subscribes to catalog changes and returns a cleanup callback. */
  public subscribe(onRevision: (revision: number) => void, onError: (error: Error) => void): () => void {
    const events = new EventSource(new URL("/client/v1/catalog/events", this.runtimeOrigin));
    events.addEventListener("catalog", event => {
      const revision = Number((event as MessageEvent<string>).data);
      if (Number.isSafeInteger(revision) && revision >= 0) onRevision(revision);
    });
    events.addEventListener("error", () => onError(new Error("Extension catalog notification stream was interrupted.")));
    return () => events.close();
  }
}
