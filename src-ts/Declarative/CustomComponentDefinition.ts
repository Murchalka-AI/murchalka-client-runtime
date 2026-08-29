import type { ComponentNode } from "./ComponentNode.js";
import type { JsonSchema } from "../Schemas/JsonSchema.js";

/** Defines a signed custom component expanded by the generic declarative renderer. */
export interface CustomComponentDefinition {
  readonly id: string;
  readonly version: number;
  readonly propertiesSchemaVersion: number;
  readonly eventsSchemaVersion: number;
  readonly propertiesSchema: JsonSchema;
  readonly eventsSchema: JsonSchema;
  readonly template: ComponentNode;
}
