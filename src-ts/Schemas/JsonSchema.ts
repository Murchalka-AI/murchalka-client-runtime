/** Represents the bounded JSON Schema subset enforced by the Client Runtime. */
export interface JsonSchema {
  readonly [keyword: string]: unknown;
}
