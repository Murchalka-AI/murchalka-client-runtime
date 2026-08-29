/** Contains the detached publisher signature for an extension document. */
export interface ExtensionSignature {
  readonly algorithm: "ecdsa-p256-sha256";
  readonly keyId: string;
  readonly value: string;
}
