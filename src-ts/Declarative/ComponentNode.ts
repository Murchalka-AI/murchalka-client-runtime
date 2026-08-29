/** Represents one bounded node in a declarative component tree. */
export interface ComponentNode {
  readonly component: "standard.layout" | "standard.text" | "standard.media" | "standard.form" | "standard.list" | "standard.action" | "extension-host";
  readonly id?: string;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly children?: readonly ComponentNode[];
}
