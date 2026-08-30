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
  /** Gets the maximum time allowed for an isolated WASM worker to become ready. */
  readonly wasmStartupDeadlineMilliseconds?: number;
  /** Gets the maximum time allowed for WASM compilation and execution after worker startup. */
  readonly wasmDeadlineMilliseconds: number;
}
