/** Retrieves one immutable artifact from the explicit Runtime origin. */
export interface ArtifactFetcher {
  /** Downloads bounded bytes and honors cancellation. */
  fetch(url: string, maximumBytes: number, signal?: AbortSignal): Promise<Uint8Array>;
}
