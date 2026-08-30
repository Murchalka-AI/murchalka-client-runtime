import type { ClientSecurityPolicy } from "./ClientSecurityPolicy.js";

/** Provides conservative limits shared by every shell. */
export const defaultClientSecurityPolicy: ClientSecurityPolicy = Object.freeze({
  maximumArtifactBytes: 2 * 1024 * 1024,
  maximumCatalogEntries: 128,
  maximumComponentDepth: 24,
  maximumComponentNodes: 1024,
  maximumPayloadBytes: 64 * 1024,
  maximumWasmBytes: 512 * 1024,
  maximumWasmMemoryPages: 256,
  maximumWasmFuel: 100_000,
  wasmStartupDeadlineMilliseconds: 5_000,
  wasmDeadlineMilliseconds: 250,
});
