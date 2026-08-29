import type { ArtifactFetcher } from "./ArtifactFetcher.js";

/** Downloads artifacts with redirect, content-type, and size checks. */
export class HttpArtifactFetcher implements ArtifactFetcher {
  /** Creates a fetcher restricted to one explicit loopback Runtime origin. */
  public constructor(private readonly runtimeOrigin: URL) {
    if (runtimeOrigin.protocol !== "http:" || !["127.0.0.1", "[::1]", "::1", "localhost"].includes(runtimeOrigin.hostname)) {
      throw new Error("Client artifact origin must be an explicit HTTP loopback origin.");
    }
  }

  /** Downloads one JSON artifact without following cross-origin redirects. */
  public async fetch(url: string, maximumBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
    const target = new URL(url, this.runtimeOrigin);
    if (target.origin !== this.runtimeOrigin.origin || !target.pathname.startsWith("/client/v1/artifacts/")) {
      throw new Error("Extension artifact URL escapes the configured Runtime origin.");
    }
    const request: RequestInit = { redirect: "error", cache: "no-store", credentials: "omit" };
    if (signal !== undefined) request.signal = signal;
    const response = await globalThis.fetch(target, request);
    if (!response.ok) throw new Error(`Extension artifact download failed with HTTP ${response.status}.`);
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > maximumBytes) throw new Error("Extension artifact exceeds the configured size limit.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > maximumBytes) throw new Error("Extension artifact has an invalid size.");
    return bytes;
  }
}
