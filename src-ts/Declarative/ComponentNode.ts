/** Represents one bounded node in a declarative component tree. */
export interface ComponentNode {
  readonly component: string;
  readonly id?: string;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly children?: readonly ComponentNode[];
}
