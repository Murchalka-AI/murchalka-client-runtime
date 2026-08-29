import type { ClientActionDefinition } from "../Actions/ClientActionDefinition.js";

/** Supplies safe shell callbacks to the declarative DOM renderer. */
export interface RenderContext {
  readonly locale: string;
  readonly dispatchAction: (definition: ClientActionDefinition, payload: unknown) => Promise<unknown>;
  readonly onError: (error: Error) => void;
  readonly wasmResults: ReadonlyMap<string, number>;
}
