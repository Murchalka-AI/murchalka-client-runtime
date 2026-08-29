/** Carries one untrusted action request to its authenticated server-side validator. */
export interface ClientActionRequest {
  readonly extensionId: string;
  readonly actionId: string;
  readonly handlerModule: string;
  readonly idempotencyKey: string;
  readonly payload: unknown;
}
