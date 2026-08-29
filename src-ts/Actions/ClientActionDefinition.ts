/** Declares a client action whose payload is validated again by its server handler. */
export interface ClientActionDefinition {
  readonly id: string;
  readonly handlerModule: string;
  readonly payloadSchemaVersion: number;
  readonly confirmation?: string;
}
