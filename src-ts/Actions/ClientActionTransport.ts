import type { ClientActionRequest } from "./ClientActionRequest.js";

/** Defines the authenticated shell transport for server-validated actions. */
export interface ClientActionTransport {
  /** Sends an untrusted action request to the Runtime boundary. */
  dispatch(request: ClientActionRequest, signal?: AbortSignal): Promise<unknown>;
}
