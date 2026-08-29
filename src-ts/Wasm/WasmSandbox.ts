import type { ClientSecurityPolicy } from "../Security/ClientSecurityPolicy.js";
import type { WasmExecutionResult } from "./WasmExecutionResult.js";
import { WasmBinaryInspector } from "./WasmBinaryInspector.js";

/** Executes a WASM component in a disposable, networkless worker with bounded resources. */
export class WasmSandbox {
  private readonly inspector = new WasmBinaryInspector();

  /** Creates a WASM sandbox with shared Client Runtime limits. */
  public constructor(private readonly policy: ClientSecurityPolicy) {}

  /** Invokes an exported zero-argument function and terminates the worker at the deadline. */
  public execute(wasmBase64: string, exportName: string, signal?: AbortSignal): Promise<WasmExecutionResult> {
    const bytes = Uint8Array.from(atob(wasmBase64), character => character.charCodeAt(0));
    if (bytes.byteLength === 0 || bytes.byteLength > this.policy.maximumWasmBytes) {
      return Promise.reject(new Error("WASM component exceeds the configured size limit."));
    }
    let declaredMemoryPages: number;
    try { declaredMemoryPages = this.inspector.maximumMemoryPages(bytes); }
    catch (error) { return Promise.reject(error); }
    if (declaredMemoryPages > this.policy.maximumWasmMemoryPages) return Promise.reject(new Error("WASM component declares memory outside the configured limit."));
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(exportName)) return Promise.reject(new Error("WASM export name is invalid."));
    const workerSource = this.workerSource();
    const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    const worker = new Worker(workerUrl, { name: "murchalka-wasm-sandbox" });
    URL.revokeObjectURL(workerUrl);
    return new Promise<WasmExecutionResult>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error("WASM component exceeded its execution deadline.")), this.policy.wasmDeadlineMilliseconds);
      const aborted = (): void => finish(new DOMException("WASM execution was cancelled.", "AbortError"));
      const finish = (error?: Error, result?: WasmExecutionResult): void => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", aborted);
        worker.terminate();
        if (error !== undefined) reject(error);
        else if (result !== undefined) resolve(result);
        else reject(new Error("WASM component returned no result."));
      };
      worker.addEventListener("message", event => {
        const response = event.data as Partial<WasmExecutionResult> & { readonly error?: unknown };
        if (typeof response.error === "string") finish(new Error(response.error));
        else if (typeof response.value === "number" && typeof response.fuelRemaining === "number" && typeof response.memoryPages === "number") {
          if (response.memoryPages > this.policy.maximumWasmMemoryPages) finish(new Error("WASM component exceeded its memory limit."));
          else finish(undefined, { value: response.value, fuelRemaining: response.fuelRemaining, memoryPages: response.memoryPages });
        } else finish(new Error("WASM component returned an invalid result."));
      }, { once: true });
      worker.addEventListener("error", () => finish(new Error("WASM component failed inside its worker.")), { once: true });
      signal?.addEventListener("abort", aborted, { once: true });
      if (signal?.aborted === true) {
        aborted();
        return;
      }
      worker.postMessage({ bytes, exportName, fuel: this.policy.maximumWasmFuel, maximumMemoryPages: this.policy.maximumWasmMemoryPages }, [bytes.buffer]);
    });
  }

  private workerSource(): string {
    return `
      "use strict";
      globalThis.fetch = () => Promise.reject(new Error("Direct network access is disabled."));
      globalThis.WebSocket = undefined;
      globalThis.EventSource = undefined;
      globalThis.XMLHttpRequest = undefined;
      self.onmessage = async ({ data }) => {
        let fuel = data.fuel;
        try {
          const imports = Object.freeze({ murchalka: Object.freeze({ consume_fuel: amount => {
            if (!Number.isInteger(amount) || amount <= 0 || amount > fuel) throw new Error("WASM fuel exhausted.");
            fuel -= amount;
          } }) });
          const module = await WebAssembly.compile(data.bytes);
          const moduleImports = WebAssembly.Module.imports(module);
          if (moduleImports.length !== 1 || moduleImports[0].module !== "murchalka" || moduleImports[0].name !== "consume_fuel" || moduleImports[0].kind !== "function") {
            throw new Error("WASM component must use only the Client Runtime fuel-metering import.");
          }
          const instance = await WebAssembly.instantiate(module, imports);
          const exported = instance.exports[data.exportName];
          if (typeof exported !== "function") throw new Error("WASM export is missing.");
          let memoryPages = 0;
          for (const candidate of Object.values(instance.exports)) {
            if (candidate instanceof WebAssembly.Memory) memoryPages = Math.max(memoryPages, candidate.buffer.byteLength / 65536);
          }
          if (memoryPages > data.maximumMemoryPages) throw new Error("WASM memory limit exceeded.");
          const value = exported();
          if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("WASM export must return a finite number.");
          for (const candidate of Object.values(instance.exports)) {
            if (candidate instanceof WebAssembly.Memory) memoryPages = Math.max(memoryPages, candidate.buffer.byteLength / 65536);
          }
          if (memoryPages > data.maximumMemoryPages) throw new Error("WASM memory limit exceeded.");
          if (fuel === data.fuel) throw new Error("WASM component did not consume metered fuel.");
          self.postMessage({ value, fuelRemaining: fuel, memoryPages });
        } catch (error) {
          self.postMessage({ error: error instanceof Error ? error.message : "WASM execution failed." });
        }
      };
    `;
  }
}
