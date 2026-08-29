/** Defines fail-closed size, complexity, and execution limits. */
export interface ClientSecurityPolicy {
  readonly maximumArtifactBytes: number;
  readonly maximumCatalogEntries: number;
  readonly maximumComponentDepth: number;
  readonly maximumComponentNodes: number;
  readonly maximumPayloadBytes: number;
  readonly maximumWasmBytes: number;
  readonly maximumWasmMemoryPages: number;
  readonly maximumWasmFuel: number;
  readonly wasmDeadlineMilliseconds: number;
}
