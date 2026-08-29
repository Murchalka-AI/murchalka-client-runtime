import { canonicalJson } from "./CanonicalJson.js";
import type { TrustedPublisher } from "./TrustedPublisher.js";
import type { SignedClientExtension } from "../Protocol/SignedClientExtension.js";

/** Verifies signed extension documents against an explicit publisher trust set. */
export class ExtensionSignatureVerifier {
  private readonly publishers: ReadonlyMap<string, TrustedPublisher>;

  /** Creates a verifier from installation-approved publisher keys. */
  public constructor(publishers: readonly TrustedPublisher[]) {
    this.publishers = new Map(publishers.map(value => [`${value.publisher}/${value.keyId}`, value]));
  }

  /** Verifies the detached ECDSA P-256 signature of an extension. */
  public async verify(document: SignedClientExtension, publisher: string): Promise<void> {
    if (document.signature.algorithm !== "ecdsa-p256-sha256") throw new Error("Extension signature algorithm is unsupported.");
    const trusted = this.publishers.get(`${publisher}/${document.signature.keyId}`);
    if (trusted === undefined) throw new Error("Extension publisher key is not trusted by this client.");
    const key = await crypto.subtle.importKey(
      "spki",
      this.decodePem(trusted.publicKeyPem),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const signature = Uint8Array.from(atob(document.signature.value), value => value.charCodeAt(0));
    const payload = new TextEncoder().encode(canonicalJson(document.extension));
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, payload);
    if (!valid) throw new Error("Extension publisher signature is invalid.");
  }

  private decodePem(value: string): ArrayBuffer {
    const base64 = value.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, "");
    if (base64.length === 0) throw new Error("Trusted publisher key is invalid.");
    return Uint8Array.from(atob(base64), character => character.charCodeAt(0)).buffer;
  }
}
