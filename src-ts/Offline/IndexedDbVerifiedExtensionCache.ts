import type { VerifiedExtensionCache } from "./VerifiedExtensionCache.js";

/** Persists verified immutable extension artifacts in a browser-managed origin database. */
export class IndexedDbVerifiedExtensionCache implements VerifiedExtensionCache {
  private readonly database: Promise<IDBDatabase>;

  /** Opens a versioned verified-artifact cache for the current shell origin. */
  public constructor(private readonly maximumEntries = 64, databaseName = "murchalka-client-runtime") {
    if (!Number.isInteger(maximumEntries) || maximumEntries < 1 || maximumEntries > 512) throw new Error("Cache entry limit is invalid.");
    this.database = this.open(databaseName);
  }

  /** Reads verified bytes and refreshes their least-recently-used timestamp. */
  public async get(digest: string): Promise<Uint8Array | undefined> {
    const database = await this.database;
    const value = await this.request<CacheEntry | undefined>(database.transaction("artifacts", "readonly").objectStore("artifacts").get(digest));
    if (value === undefined) return undefined;
    await this.write({ ...value, accessedAt: Date.now() });
    return new Uint8Array(value.bytes.slice(0));
  }

  /** Stores defensive bytes and evicts the oldest verified artifacts. */
  public async put(digest: string, bytes: Uint8Array): Promise<void> {
    await this.write({ digest, bytes: Uint8Array.from(bytes).buffer, accessedAt: Date.now() });
    const database = await this.database;
    const entries = await this.request<CacheEntry[]>(database.transaction("artifacts", "readonly").objectStore("artifacts").getAll());
    entries.sort((left, right) => left.accessedAt - right.accessedAt);
    await Promise.all(entries.slice(0, Math.max(0, entries.length - this.maximumEntries)).map(entry => this.delete(entry.digest)));
  }

  /** Deletes a failed or obsolete immutable artifact. */
  public async delete(digest: string): Promise<void> {
    const database = await this.database;
    await this.request(database.transaction("artifacts", "readwrite").objectStore("artifacts").delete(digest));
  }

  private open(name: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.addEventListener("upgradeneeded", () => request.result.createObjectStore("artifacts", { keyPath: "digest" }));
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error ?? new Error("Verified cache could not be opened.")), { once: true });
      request.addEventListener("blocked", () => reject(new Error("Verified cache upgrade is blocked.")), { once: true });
    });
  }

  private async write(value: CacheEntry): Promise<void> {
    const database = await this.database;
    await this.request(database.transaction("artifacts", "readwrite").objectStore("artifacts").put(value));
  }

  private request<T = undefined>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error ?? new Error("Verified cache operation failed.")), { once: true });
    });
  }
}

interface CacheEntry {
  readonly digest: string;
  readonly bytes: ArrayBuffer;
  readonly accessedAt: number;
}
