import type { ClientActionDefinition } from "./ClientActionDefinition.js";
import type { ClientActionTransport } from "./ClientActionTransport.js";
import type { ClientSecurityPolicy } from "../Security/ClientSecurityPolicy.js";

/** Bounds client action payloads and delegates authority to the authenticated server. */
export class ActionDispatcher {
  /** Creates an action dispatcher for one shell transport. */
  public constructor(
    private readonly transport: ClientActionTransport,
    private readonly policy: ClientSecurityPolicy,
  ) {}

  /** Dispatches a declared action without granting any client-side authority. */
  public async dispatch(extensionId: string, definition: ClientActionDefinition, payload: unknown, signal?: AbortSignal): Promise<unknown> {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (bytes.byteLength > this.policy.maximumPayloadBytes) throw new Error("Client action payload exceeds the configured limit.");
    return this.transport.dispatch({
      extensionId,
      actionId: definition.id,
      handlerModule: definition.handlerModule,
      idempotencyKey: crypto.randomUUID(),
      payload,
    }, signal);
  }
}
