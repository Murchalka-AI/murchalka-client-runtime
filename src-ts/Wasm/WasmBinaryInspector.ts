/** Reads declared WASM memory limits before a module can be instantiated. */
export class WasmBinaryInspector {
  /** Returns the declared maximum memory pages and rejects unbounded or unsupported memory declarations. */
  public maximumMemoryPages(bytes: Uint8Array): number {
    if (bytes.byteLength < 8 || bytes[0] !== 0 || bytes[1] !== 97 || bytes[2] !== 115 || bytes[3] !== 109 || bytes[4] !== 1 || bytes[5] !== 0 || bytes[6] !== 0 || bytes[7] !== 0) {
      throw new Error("WASM component has an invalid binary header.");
    }
    let offset = 8;
    let maximum = 0;
    while (offset < bytes.length) {
      const sectionId = bytes[offset++];
      const size = this.readUnsigned(bytes, offset);
      offset = size.offset;
      const end = offset + size.value;
      if (end > bytes.length) throw new Error("WASM component contains a truncated section.");
      if (sectionId === 5) {
        const count = this.readUnsigned(bytes, offset);
        offset = count.offset;
        if (count.value > 1) throw new Error("WASM component declares too many memories.");
        for (let index = 0; index < count.value; index += 1) {
          const flags = this.readUnsigned(bytes, offset);
          offset = flags.offset;
          if (flags.value !== 1) throw new Error("WASM memory must declare a bounded 32-bit maximum.");
          const initial = this.readUnsigned(bytes, offset);
          offset = initial.offset;
          const limit = this.readUnsigned(bytes, offset);
          offset = limit.offset;
          if (initial.value > limit.value) throw new Error("WASM memory minimum exceeds its maximum.");
          maximum = Math.max(maximum, limit.value);
        }
      }
      offset = end;
    }
    return maximum;
  }

  private readUnsigned(bytes: Uint8Array, start: number): { readonly value: number; readonly offset: number } {
    let value = 0;
    let shift = 0;
    let offset = start;
    while (offset < bytes.length && shift <= 28) {
      const byte = bytes[offset++]!;
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return { value: value >>> 0, offset };
      shift += 7;
    }
    throw new Error("WASM component contains an invalid integer encoding.");
  }
}
