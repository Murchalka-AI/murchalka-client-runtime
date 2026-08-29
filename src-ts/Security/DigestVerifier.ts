/** Verifies a content-addressed artifact without exposing its bytes to activation first. */
export class DigestVerifier {
  /** Computes the lowercase SHA-256 digest of an immutable byte sequence. */
  public async compute(bytes: Uint8Array): Promise<`sha256:${string}`> {
    const input = new Uint8Array(bytes).buffer;
    const digest = await crypto.subtle.digest("SHA-256", input);
    return `sha256:${Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("")}`;
  }

  /** Rejects bytes that do not match the catalog digest. */
  public async verify(bytes: Uint8Array, expected: string): Promise<void> {
    const actual = await this.compute(bytes);
    if (!this.fixedTimeEqual(actual, expected)) throw new Error("Extension artifact digest does not match the trusted catalog.");
  }

  private fixedTimeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return difference === 0;
  }
}
