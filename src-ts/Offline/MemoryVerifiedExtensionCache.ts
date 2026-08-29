import type { VerifiedExtensionCache } from "./VerifiedExtensionCache.js";

/** Provides a bounded in-memory verified artifact cache. */
export class MemoryVerifiedExtensionCache implements VerifiedExtensionCache {
  private readonly values = new Map<string, Uint8Array>();

  /** Creates a cache with a bounded number of content-addressed artifacts. */
  public constructor(private readonly maximumEntries = 64) {
    if (!Number.isInteger(maximumEntries) || maximumEntries < 1) throw new Error("Cache entry limit must be positive.");
  }

  /** Reads an immutable defensive copy. */
  public get(digest: string): Promise<Uint8Array | undefined> {
    const value = this.values.get(digest);
    if (value !== undefined) {
      this.values.delete(digest);
      this.values.set(digest, value);
    }
    return Promise.resolve(value === undefined ? undefined : value.slice());
  }

  /** Stores an immutable defensive copy and evicts the least recently used entry. */
  public put(digest: string, bytes: Uint8Array): Promise<void> {
    this.values.delete(digest);
    this.values.set(digest, bytes.slice());
    while (this.values.size > this.maximumEntries) {
      const oldest = this.values.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.values.delete(oldest);
    }
    return Promise.resolve();
  }

  /** Removes one cached digest. */
  public delete(digest: string): Promise<void> {
    this.values.delete(digest);
    return Promise.resolve();
  }
}
