import type { ClientExtension } from "../Protocol/ClientExtension.js";
import type { ComponentNode } from "./ComponentNode.js";
import type { RenderContext } from "./RenderContext.js";

/** Renders the closed standard component set using DOM APIs and text nodes only. */
export class DeclarativeDomRenderer {
  /** Replaces a host's children with one safe declarative tree. */
  public render(host: HTMLElement, extension: ClientExtension, context: RenderContext): void {
    host.replaceChildren(this.create(extension.componentTree, extension, context));
    host.setAttribute("aria-label", extension.accessibility.label);
    if (extension.accessibility.description !== undefined) host.setAttribute("aria-description", extension.accessibility.description);
    host.setAttribute("data-extension-id", extension.id);
  }

  private create(node: ComponentNode, extension: ClientExtension, context: RenderContext): HTMLElement {
    const element = document.createElement(this.tag(node.component));
    if (node.id !== undefined) element.dataset.componentId = node.id;
    const properties = node.properties ?? {};
    if (node.component === "standard.text") element.textContent = this.string(properties, "text", "");
    if (node.component === "standard.layout") element.className = `murchalka-layout ${this.enumValue(properties, "direction", ["row", "column"], "column")}`;
    if (node.component === "standard.list") {
      const label = this.string(properties, "label", extension.accessibility.label);
      element.setAttribute("aria-label", label);
    }
    if (node.component === "standard.media") {
      element.textContent = this.string(properties, "alt", "Media unavailable");
      element.setAttribute("role", "img");
    }
    if (node.component === "standard.form") {
      element.addEventListener("submit", event => event.preventDefault());
    }
    if (node.component === "standard.action") this.configureAction(element as HTMLButtonElement, properties, extension, context);
    if (node.component === "extension-host") {
      const value = node.id === undefined ? undefined : context.wasmResults.get(node.id);
      if (value !== undefined) {
        element.replaceChildren(document.createTextNode(this.string(properties, "resultLabel", "Sandboxed result") + `: ${value}`));
        element.setAttribute("role", "status");
      }
    }
    node.children?.forEach(child => element.append(this.create(child, extension, context)));
    return element;
  }

  private configureAction(button: HTMLButtonElement, properties: Readonly<Record<string, unknown>>, extension: ClientExtension, context: RenderContext): void {
    button.type = "button";
    button.textContent = this.string(properties, "label", "Continue");
    const actionId = this.string(properties, "action", "");
    const definition = extension.actions.find(action => action.id === actionId);
    if (definition === undefined) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      return;
    }
    button.addEventListener("click", () => {
      button.disabled = true;
      void context.dispatchAction(definition, properties.payload ?? {}).catch(error => {
        context.onError(error instanceof Error ? error : new Error("Client action failed."));
      }).finally(() => { button.disabled = false; });
    });
  }

  private tag(component: ComponentNode["component"]): keyof HTMLElementTagNameMap {
    switch (component) {
      case "standard.layout": return "section";
      case "standard.text": return "p";
      case "standard.media": return "figure";
      case "standard.form": return "form";
      case "standard.list": return "ul";
      case "standard.action": return "button";
      case "extension-host": return "section";
    }
  }

  private string(properties: Readonly<Record<string, unknown>>, name: string, fallback: string): string {
    const value = properties[name];
    return typeof value === "string" && value.length <= 2048 ? value : fallback;
  }

  private enumValue(properties: Readonly<Record<string, unknown>>, name: string, values: readonly string[], fallback: string): string {
    const value = properties[name];
    return typeof value === "string" && values.includes(value) ? value : fallback;
  }
}
