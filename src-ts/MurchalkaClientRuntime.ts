import { ActionDispatcher } from "./Actions/ActionDispatcher.js";
import { DeclarativeDomRenderer } from "./Declarative/DeclarativeDomRenderer.js";
import type { ComponentNode } from "./Declarative/ComponentNode.js";
import type { CustomComponentDefinition } from "./Declarative/CustomComponentDefinition.js";
import { ExtensionRegistry } from "./ExtensionRegistry/ExtensionRegistry.js";
import type { ExtensionRegistrySnapshot } from "./ExtensionRegistry/ExtensionRegistrySnapshot.js";
import type { ExtensionCatalogSnapshot } from "./Protocol/ExtensionCatalogSnapshot.js";
import type { ClientExtension } from "./Protocol/ClientExtension.js";
import { ExtensionSignatureVerifier } from "./Security/ExtensionSignatureVerifier.js";
import { WasmSandbox } from "./Wasm/WasmSandbox.js";
import type { ClientRuntimeOptions } from "./ClientRuntimeOptions.js";

/** Coordinates catalog activation, safe rendering, and server-validated actions. */
export class MurchalkaClientRuntime {
  private readonly registry: ExtensionRegistry;
  private readonly actions: ActionDispatcher;
  private readonly renderer = new DeclarativeDomRenderer();
  private readonly wasm: WasmSandbox;
  private activeWasmResults = new Map<string, ReadonlyMap<string, number>>();

  /** Creates a product-agnostic Client Runtime for one shell. */
  public constructor(options: ClientRuntimeOptions) {
    this.wasm = new WasmSandbox(options.securityPolicy);
    this.registry = new ExtensionRegistry(
      options.target,
      options.artifactFetcher,
      options.artifactCache,
      new ExtensionSignatureVerifier(options.trustedPublishers),
      options.securityPolicy,
    );
    this.actions = new ActionDispatcher(options.actionTransport, options.securityPolicy);
  }

  /** Verifies, preflights, and atomically activates one complete catalog revision. */
  public async activateCatalog(snapshot: ExtensionCatalogSnapshot, signal?: AbortSignal): Promise<ExtensionRegistrySnapshot> {
    if (snapshot.revision === this.registry.snapshot().revision) return this.registry.snapshot();
    const staged = new Map<string, ReadonlyMap<string, number>>();
    const activated = await this.registry.activate(snapshot, signal, async candidate => {
      for (const item of candidate.extensions) {
        if (item.isFallback || item.extension.mode !== "wasm" || item.extension.wasmBase64 === undefined) continue;
        const results = new Map<string, number>();
        for (const component of this.wasmComponents(item.extension)) {
          const result = await this.wasm.execute(item.extension.wasmBase64, component.exportName, signal);
          results.set(component.id, result.value);
        }
        staged.set(item.extension.id, results);
      }
    });
    this.activeWasmResults = staged;
    return activated;
  }

  /** Renders every active Mini App into a fresh accessible host element. */
  public render(host: HTMLElement, locale: string, onError: (error: Error) => void, _signal?: AbortSignal): Promise<void> {
    const fragment = document.createDocumentFragment();
    for (const activated of this.registry.snapshot().extensions) {
      const extensionHost = document.createElement("article");
      extensionHost.className = "murchalka-mini-app";
      this.renderer.render(extensionHost, activated.extension, {
        locale,
        onError,
        wasmResults: this.activeWasmResults.get(activated.extension.id) ?? new Map(),
        dispatchAction: (definition, payload) => this.actions.dispatch(activated.extension.id, definition, payload),
      });
      fragment.append(extensionHost);
    }
    host.replaceChildren(fragment);
    host.dataset.catalogRevision = String(this.registry.snapshot().revision);
    return Promise.resolve();
  }

  /** Gets the active catalog revision. */
  public get revision(): number {
    return this.registry.snapshot().revision;
  }

  private wasmComponents(extension: ClientExtension): readonly { readonly id: string; readonly exportName: string }[] {
    const result: { readonly id: string; readonly exportName: string }[] = [];
    const definitions = new Map((extension.componentDefinitions ?? []).map(definition => [definition.id, definition]));
    const visit = (node: ComponentNode, scope?: string): void => {
      const custom = definitions.get(node.component);
      if (custom !== undefined) {
        this.visitTemplate(custom, node.id ?? custom.id, visit);
        return;
      }
      const exportName = node.properties?.export;
      if (node.component === "extension-host" && node.id !== undefined && typeof exportName === "string") {
        result.push({ id: scope === undefined ? node.id : `${scope}:${node.id}`, exportName });
      }
      node.children?.forEach(child => visit(child, scope));
    };
    visit(extension.componentTree);
    return result;
  }

  private visitTemplate(definition: CustomComponentDefinition, scope: string, visit: (node: ComponentNode, scope?: string) => void): void {
    visit(definition.template, scope);
  }
}
