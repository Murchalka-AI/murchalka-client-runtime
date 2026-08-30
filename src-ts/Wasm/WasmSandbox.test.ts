import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultClientSecurityPolicy } from "../Security/defaultClientSecurityPolicy.js";
import { WasmSandbox } from "./WasmSandbox.js";

const meteredWasm = "AGFzbQEAAAABCQJgAX8AYAABfwIaAQltdXJjaGFsa2EMY29uc3VtZV9mdWVsAAADAgEBBxQBEGRpYWdub3N0aWNfdmFsdWUAAQoKAQgAQQEQAEEHCw==";

class FakeWorker {
  public static readyDelayMilliseconds = 0;
  public static resultDelayMilliseconds = 0;
  public static sendsReady = true;

  private readonly listeners = new Map<string, Array<(event: MessageEvent) => void>>();

  public constructor() {
    if (FakeWorker.sendsReady) {
      setTimeout(() => this.emit("message", { type: "ready" }), FakeWorker.readyDelayMilliseconds);
    }
  }

  public addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  public postMessage(): void {
    setTimeout(
      () => this.emit("message", { type: "result", value: 7, fuelRemaining: 99_999, memoryPages: 0 }),
      FakeWorker.resultDelayMilliseconds,
    );
  }

  public terminate(): void {}

  private emit(type: string, data: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ data } as MessageEvent);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWorker.readyDelayMilliseconds = 0;
  FakeWorker.resultDelayMilliseconds = 0;
  FakeWorker.sendsReady = true;
});

describe("WasmSandbox", () => {
  it("starts the execution deadline after the worker is ready", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:murchalka-test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    FakeWorker.readyDelayMilliseconds = 20;
    FakeWorker.resultDelayMilliseconds = 5;
    const sandbox = new WasmSandbox({
      ...defaultClientSecurityPolicy,
      wasmStartupDeadlineMilliseconds: 50,
      wasmDeadlineMilliseconds: 10,
    });

    const result = sandbox.execute(meteredWasm, "diagnostic_value");
    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toEqual({ value: 7, fuelRemaining: 99_999, memoryPages: 0 });
  });

  it("rejects a worker that never becomes ready", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:murchalka-test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    FakeWorker.sendsReady = false;
    const sandbox = new WasmSandbox({
      ...defaultClientSecurityPolicy,
      wasmStartupDeadlineMilliseconds: 15,
    });

    const assertion = expect(sandbox.execute(meteredWasm, "diagnostic_value")).rejects.toThrow(
      "WASM worker exceeded its startup deadline.",
    );
    await vi.advanceTimersByTimeAsync(15);

    await assertion;
  });

  it("retains the execution deadline after worker startup", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:murchalka-test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    FakeWorker.resultDelayMilliseconds = 20;
    const sandbox = new WasmSandbox({
      ...defaultClientSecurityPolicy,
      wasmStartupDeadlineMilliseconds: 50,
      wasmDeadlineMilliseconds: 10,
    });

    const assertion = expect(sandbox.execute(meteredWasm, "diagnostic_value")).rejects.toThrow(
      "WASM component exceeded its execution deadline.",
    );
    await vi.advanceTimersByTimeAsync(10);

    await assertion;
  });
});
