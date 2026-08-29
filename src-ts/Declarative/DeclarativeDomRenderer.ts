import type { ClientExtension } from "../Protocol/ClientExtension.js";
import { LocalizationResolver } from "../Localization/LocalizationResolver.js";
import { JsonSchemaValidator } from "../Schemas/JsonSchemaValidator.js";
import type { ClientActionDefinition } from "../Actions/ClientActionDefinition.js";
import type { ComponentNode } from "./ComponentNode.js";
import type { CustomComponentDefinition } from "./CustomComponentDefinition.js";
import type { RenderContext } from "./RenderContext.js";

/** Renders standard and signed custom components using DOM APIs and text nodes only. */
export class DeclarativeDomRenderer {
  private readonly localization = new LocalizationResolver();
  private readonly schemas = new JsonSchemaValidator();

  /** Replaces a host's children with one safe declarative tree. */
  public render(host: HTMLElement, extension: ClientExtension, context: RenderContext): void {
    const definitions = new Map((extension.componentDefinitions ?? []).map(definition => [definition.id, definition]));
    host.replaceChildren(this.create(extension.componentTree, extension, context, definitions, {}, undefined));
    host.setAttribute("aria-label", extension.accessibility.label);
    if (extension.accessibility.description !== undefined) host.setAttribute("aria-description", extension.accessibility.description);
    host.setAttribute("data-extension-id", extension.id);
  }

  private create(
    node: ComponentNode,
    extension: ClientExtension,
    context: RenderContext,
    definitions: ReadonlyMap<string, CustomComponentDefinition>,
    customProperties: Readonly<Record<string, unknown>>,
    scope: string | undefined,
  ): HTMLElement {
    const definition = definitions.get(node.component);
    if (definition !== undefined) return this.createCustom(node, definition, extension, context, definitions);
    const element = document.createElement(this.tag(node.component));
    if (node.id !== undefined) element.dataset.componentId = node.id;
    const properties = this.resolveProperties(node.properties ?? {}, extension, context, customProperties, scope);
    if (node.component === "standard.document") element.className = "murchalka-document";
    if (node.component === "standard.text") element.textContent = this.string(properties, "text", "");
    if (node.component === "standard.layout") element.className = `murchalka-layout ${this.enumValue(properties, "direction", ["row", "column", "vertical", "horizontal"], "column")}`;
    if (node.component === "standard.list") element.setAttribute("aria-label", this.string(properties, "label", extension.accessibility.label));
    if (node.component === "standard.media") {
      element.textContent = this.string(properties, "alt", "Media unavailable");
      element.setAttribute("role", "img");
    }
    if (node.component === "standard.form") element.addEventListener("submit", event => event.preventDefault());
    if (node.component === "standard.action") this.configureAction(element as HTMLButtonElement, properties, extension, context, undefined);
    if (node.component === "extension-host") {
      const resultKey = this.scopedId(scope, node.id);
      const value = resultKey === undefined ? undefined : context.wasmResults.get(resultKey);
      if (value !== undefined) {
        element.replaceChildren(document.createTextNode(this.string(properties, "resultLabel", "Sandboxed result") + `: ${value}`));
        element.setAttribute("role", "status");
      }
    }
    node.children?.forEach(child => element.append(this.create(child, extension, context, definitions, customProperties, scope)));
    return element;
  }

  private createCustom(
    node: ComponentNode,
    definition: CustomComponentDefinition,
    extension: ClientExtension,
    context: RenderContext,
    definitions: ReadonlyMap<string, CustomComponentDefinition>,
  ): HTMLElement {
    const properties = node.properties ?? {};
    this.schemas.validate(properties, definition.propertiesSchema, `${definition.id} properties`);
    const host = document.createElement("section");
    const scope = node.id ?? definition.id;
    host.className = "murchalka-custom-component";
    host.dataset.component = definition.id;
    host.dataset.componentVersion = String(definition.version);
    host.append(this.createTemplate(definition.template, definition, extension, context, definitions, properties, scope, host));
    node.children?.forEach(child => host.append(this.create(child, extension, context, definitions, properties, scope)));
    return host;
  }

  private createTemplate(
    node: ComponentNode,
    definition: CustomComponentDefinition,
    extension: ClientExtension,
    context: RenderContext,
    definitions: ReadonlyMap<string, CustomComponentDefinition>,
    customProperties: Readonly<Record<string, unknown>>,
    scope: string,
    eventHost: HTMLElement,
  ): HTMLElement {
    const element = document.createElement(this.tag(node.component));
    if (node.id !== undefined) element.dataset.componentId = node.id;
    const properties = this.resolveProperties(node.properties ?? {}, extension, context, customProperties, scope);
    if (node.component === "standard.document") element.className = "murchalka-document";
    if (node.component === "standard.text") element.textContent = this.string(properties, "text", "");
    if (node.component === "standard.layout") element.className = `murchalka-layout ${this.enumValue(properties, "direction", ["row", "column", "vertical", "horizontal"], "column")}`;
    if (node.component === "standard.list") element.setAttribute("aria-label", this.string(properties, "label", extension.accessibility.label));
    if (node.component === "standard.media") {
      element.textContent = this.string(properties, "alt", "Media unavailable");
      element.setAttribute("role", "img");
    }
    if (node.component === "standard.form") element.addEventListener("submit", event => event.preventDefault());
    if (node.component === "standard.action") this.configureAction(element as HTMLButtonElement, properties, extension, context, { definition, eventHost });
    if (node.component === "extension-host") {
      const value = context.wasmResults.get(this.scopedId(scope, node.id) ?? "");
      if (value !== undefined) {
        element.replaceChildren(document.createTextNode(this.string(properties, "resultLabel", "Sandboxed result") + `: ${value}`));
        element.setAttribute("role", "status");
      }
    }
    node.children?.forEach(child => element.append(this.createTemplate(child, definition, extension, context, definitions, customProperties, scope, eventHost)));
    return element;
  }

  private configureAction(
    button: HTMLButtonElement,
    properties: Readonly<Record<string, unknown>>,
    extension: ClientExtension,
    context: RenderContext,
    event: { readonly definition: CustomComponentDefinition; readonly eventHost: HTMLElement } | undefined,
  ): void {
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
      void this.dispatch(definition, properties.payload ?? {}, context, event).catch(error => {
        context.onError(error instanceof Error ? error : new Error("Client action failed."));
      }).finally(() => { button.disabled = false; });
    });
  }

  private async dispatch(
    definition: ClientActionDefinition,
    payload: unknown,
    context: RenderContext,
    event: { readonly definition: CustomComponentDefinition; readonly eventHost: HTMLElement } | undefined,
  ): Promise<void> {
    const result = await context.dispatchAction(definition, payload);
    if (event === undefined) return;
    this.schemas.validate(result, event.definition.eventsSchema, `${event.definition.id} event`);
    event.eventHost.dispatchEvent(new CustomEvent("murchalka:component-event", {
      bubbles: true,
      detail: Object.freeze({ componentId: event.definition.id, schemaVersion: event.definition.eventsSchemaVersion, value: result }),
    }));
  }

  private resolveProperties(
    source: Readonly<Record<string, unknown>>,
    extension: ClientExtension,
    context: RenderContext,
    customProperties: Readonly<Record<string, unknown>>,
    scope: string | undefined,
  ): Readonly<Record<string, unknown>> {
    return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, this.resolve(value, extension, context, customProperties, scope)]));
  }

  private resolve(value: unknown, extension: ClientExtension, context: RenderContext, customProperties: Readonly<Record<string, unknown>>, scope: string | undefined): unknown {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    const binding = value as Readonly<Record<string, unknown>>;
    if (Object.keys(binding).length !== 1 || typeof binding.$bind !== "string") return value;
    const [source, key] = binding.$bind.split(".", 2);
    if (key === undefined) return "";
    if (source === "property") return customProperties[key] ?? "";
    if (source === "message") return this.localization.resolve(extension.localization, context.locale, key, key);
    if (source === "wasm") return context.wasmResults.get(this.scopedId(scope, key) ?? "") ?? "";
    return "";
  }

  private scopedId(scope: string | undefined, id: string | undefined): string | undefined {
    if (id === undefined) return undefined;
    return scope === undefined ? id : `${scope}:${id}`;
  }

  private tag(component: string): keyof HTMLElementTagNameMap {
    switch (component) {
      case "standard.document": return "article";
      case "standard.layout": return "section";
      case "standard.text": return "p";
      case "standard.media": return "figure";
      case "standard.form": return "form";
      case "standard.list": return "ul";
      case "standard.action": return "button";
      case "extension-host": return "section";
      default: throw new Error(`Unsupported template component '${component}'.`);
    }
  }

  private string(properties: Readonly<Record<string, unknown>>, name: string, fallback: string): string {
    const value = properties[name];
    return typeof value === "string" && value.length <= 4096 ? value : fallback;
  }

  private enumValue(properties: Readonly<Record<string, unknown>>, name: string, values: readonly string[], fallback: string): string {
    const value = properties[name];
    return typeof value === "string" && values.includes(value) ? value : fallback;
  }
}
