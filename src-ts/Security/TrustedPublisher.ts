/** Provides one explicitly trusted ECDSA public key. */
export interface TrustedPublisher {
  readonly publisher: string;
  readonly keyId: string;
  readonly publicKeyPem: string;
}
