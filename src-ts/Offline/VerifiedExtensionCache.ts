/** Stores only artifacts that already passed digest and publisher verification. */
export interface VerifiedExtensionCache {
  /** Reads verified bytes by immutable digest. */
  get(digest: string): Promise<Uint8Array | undefined>;
  /** Stores verified bytes by immutable digest. */
  put(digest: string, bytes: Uint8Array): Promise<void>;
  /** Removes an artifact that failed revalidation or is no longer usable. */
  delete(digest: string): Promise<void>;
}
