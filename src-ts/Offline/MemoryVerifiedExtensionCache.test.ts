import { describe, expect, it } from "vitest";
import { MemoryVerifiedExtensionCache } from "./MemoryVerifiedExtensionCache.js";

describe("MemoryVerifiedExtensionCache", () => {
  it("uses defensive copies and bounded least-recently-used eviction", async () => {
    const cache = new MemoryVerifiedExtensionCache(2);
    const source = new Uint8Array([1]);
    await cache.put("a", source);
    source[0] = 9;
    await cache.put("b", new Uint8Array([2]));
    expect((await cache.get("a"))?.[0]).toBe(1);
    await cache.put("c", new Uint8Array([3]));
    expect(await cache.get("b")).toBeUndefined();
    expect((await cache.get("a"))?.[0]).toBe(1);
  });
});
