/** Contains the bounded scalar result returned by a sandboxed WASM component. */
export interface WasmExecutionResult {
  readonly value: number;
  readonly fuelRemaining: number;
  readonly memoryPages: number;
}
