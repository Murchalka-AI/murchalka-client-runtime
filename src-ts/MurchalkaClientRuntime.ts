import { ActionDispatcher } from "./Actions/ActionDispatcher.js";
import { DeclarativeDomRenderer } from "./Declarative/DeclarativeDomRenderer.js";
import { ExtensionRegistry } from "./ExtensionRegistry/ExtensionRegistry.js";
import type { ExtensionCatalogSnapshot } from "./Protocol/ExtensionCatalogSnapshot.js";
import { ExtensionSignatureVerifier } from "./Security/ExtensionSignatureVerifier.js";
import { WasmSandbox } from "./Wasm/WasmSandbox.js";
import type { ClientRuntimeOptions } from "./ClientRuntimeOptions.js";
import type { ComponentNode } from "./Declarative/ComponentNode.js";

/** Coordinates catalog activation, safe rendering, and server-validated actions. */
export class MurchalkaClientRuntime {
  private readonly registry: ExtensionRegistry;
  private readonly actions: ActionDispatcher;
  private readonly renderer = new DeclarativeDomRenderer();
  private readonly wasm: WasmSandbox;

  /** Creates a product-agnostic Client Runtime for one shell. */
  public constructor(options: ClientRuntimeOptions) {
    this.registry = new ExtensionRegistry(
      options.target,
      options.artifactFetcher,
      options.artifactCache,
      new ExtensionSignatureVerifier(options.trustedPublishers),
      options.securityPolicy,
    );
    this.actions = new ActionDispatcher(options.actionTransport, options.securityPolicy);
    this.wasm = new WasmSandbox(options.securityPolicy);
  }

  /** Verifies and atomically activates one complete catalog revision. */
  public activateCatalog(snapshot: ExtensionCatalogSnapshot, signal?: AbortSignal): ReturnType<ExtensionRegistry["activate"]> {
    return this.registry.activate(snapshot, signal);
  }

  /** Renders every active Mini App into a fresh accessible host element. */
  public async render(host: HTMLElement, locale: string, onError: (error: Error) => void, signal?: AbortSignal): Promise<void> {
    const fragment = document.createDocumentFragment();
    for (const activated of this.registry.snapshot().extensions) {
      const extensionHost = document.createElement("article");
      extensionHost.className = "murchalka-mini-app";
      const wasmResults = new Map<string, number>();
      if (!activated.isFallback && activated.extension.mode === "wasm" && activated.extension.wasmBase64 !== undefined) {
        for (const component of this.wasmComponents(activated.extension.componentTree)) {
          try {
            const result = await this.wasm.execute(activated.extension.wasmBase64, component.exportName, signal);
            wasmResults.set(component.id, result.value);
          } catch (error) {
            onError(error instanceof Error ? error : new Error("WASM component failed."));
          }
        }
      }
      this.renderer.render(extensionHost, activated.extension, {
        locale,
        onError,
        wasmResults,
        dispatchAction: (definition, payload) => this.actions.dispatch(activated.extension.id, definition, payload),
      });
      fragment.append(extensionHost);
    }
    host.replaceChildren(fragment);
    host.dataset.catalogRevision = String(this.registry.snapshot().revision);
  }

  /** Gets the active catalog revision. */
  public get revision(): number {
    return this.registry.snapshot().revision;
  }

  private wasmComponents(root: ComponentNode): readonly { readonly id: string; readonly exportName: string }[] {
    const result: { readonly id: string; readonly exportName: string }[] = [];
    const visit = (node: ComponentNode): void => {
      const exportName = node.properties?.export;
      if (node.component === "extension-host" && node.id !== undefined && typeof exportName === "string") result.push({ id: node.id, exportName });
      node.children?.forEach(visit);
    };
    visit(root);
    return result;
  }
}
