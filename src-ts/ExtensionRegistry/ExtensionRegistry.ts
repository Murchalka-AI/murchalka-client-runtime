import type { ArtifactFetcher } from "../Assets/ArtifactFetcher.js";
import { AccessibilityValidator } from "../Accessibility/AccessibilityValidator.js";
import { ComponentTreeValidator } from "../Declarative/ComponentTreeValidator.js";
import type { ClientExtension } from "../Protocol/ClientExtension.js";
import type { ClientTarget } from "../Protocol/ClientTarget.js";
import type { ExtensionCatalogEntry } from "../Protocol/ExtensionCatalogEntry.js";
import type { ExtensionCatalogSnapshot } from "../Protocol/ExtensionCatalogSnapshot.js";
import { parseSignedClientExtension } from "../Protocol/parseSignedClientExtension.js";
import type { ClientSecurityPolicy } from "../Security/ClientSecurityPolicy.js";
import { DigestVerifier } from "../Security/DigestVerifier.js";
import { ExtensionSignatureVerifier } from "../Security/ExtensionSignatureVerifier.js";
import type { VerifiedExtensionCache } from "../Offline/VerifiedExtensionCache.js";
import type { ActivatedExtension } from "./ActivatedExtension.js";
import type { ExtensionRegistrySnapshot } from "./ExtensionRegistrySnapshot.js";

/** Downloads, verifies, caches, and atomically activates extension catalog revisions. */
export class ExtensionRegistry {
  private current: ExtensionRegistrySnapshot = { revision: 0, extensions: [] };
  private readonly digestVerifier = new DigestVerifier();
  private readonly accessibilityValidator = new AccessibilityValidator();
  private readonly componentTreeValidator = new ComponentTreeValidator();

  /** Creates a fail-closed registry for one shell target. */
  public constructor(
    private readonly target: ClientTarget,
    private readonly fetcher: ArtifactFetcher,
    private readonly cache: VerifiedExtensionCache,
    private readonly signatureVerifier: ExtensionSignatureVerifier,
    private readonly policy: ClientSecurityPolicy,
  ) {}

  /** Gets the last completely activated revision. */
  public snapshot(): ExtensionRegistrySnapshot {
    return this.current;
  }

  /** Activates a complete catalog revision or rolls back to the previous revision on any failure. */
  public async activate(snapshot: ExtensionCatalogSnapshot, signal?: AbortSignal): Promise<ExtensionRegistrySnapshot> {
    if (snapshot.revision < this.current.revision) throw new Error("Extension catalog rollback requires an explicit Runtime revision.");
    if (snapshot.revision === this.current.revision) return this.current;
    const identifiers = new Set<string>();
    const candidates: ActivatedExtension[] = [];
    for (const entry of snapshot.entries) {
      if (identifiers.has(entry.extensionId)) throw new Error(`Extension '${entry.extensionId}' is duplicated in the catalog.`);
      identifiers.add(entry.extensionId);
      candidates.push(await this.load(entry, signal));
    }
    this.current = Object.freeze({ revision: snapshot.revision, extensions: Object.freeze(candidates) });
    return this.current;
  }

  private async load(entry: ExtensionCatalogEntry, signal?: AbortSignal): Promise<ActivatedExtension> {
    if (!entry.targets.includes(this.target)) return this.fallback(entry);
    if (entry.artifactBytes < 1 || entry.artifactBytes > this.policy.maximumArtifactBytes) throw new Error("Catalog artifact size is outside policy.");
    let bytes = await this.cache.get(entry.artifactDigest);
    if (bytes !== undefined) {
      try {
        await this.digestVerifier.verify(bytes, entry.artifactDigest);
      } catch (error) {
        await this.cache.delete(entry.artifactDigest);
        throw error;
      }
    } else {
      bytes = await this.fetcher.fetch(entry.artifactUrl, this.policy.maximumArtifactBytes, signal);
      await this.digestVerifier.verify(bytes, entry.artifactDigest);
    }
    const document = parseSignedClientExtension(bytes);
    if (document.extension.id !== entry.extensionId || document.extension.version !== entry.extensionVersion ||
        document.signature.keyId !== entry.keyId || document.extension.mode !== entry.mode ||
        !this.sameTargets(document.extension.targets, entry.targets)) {
      throw new Error("Signed extension metadata does not match the catalog.");
    }
    await this.signatureVerifier.verify(document, entry.publisher);
    this.accessibilityValidator.validate(document.extension);
    this.componentTreeValidator.validate(document.extension.componentTree, this.policy);
    this.validateActions(document.extension);
    if (document.extension.expiresAt !== undefined && Date.parse(document.extension.expiresAt) <= Date.now()) {
      throw new Error("Extension document has expired.");
    }
    if (document.extension.mode === "wasm") this.validateWasm(document.extension.wasmBase64);
    await this.cache.put(entry.artifactDigest, bytes);
    return Object.freeze({ extension: document.extension, artifactDigest: entry.artifactDigest, publisher: entry.publisher, isFallback: false, activatedAt: new Date().toISOString() });
  }

  private fallback(entry: ExtensionCatalogEntry): ActivatedExtension {
    const extension: ClientExtension = {
      apiVersion: "client.murchalka.dev/v1",
      kind: "ClientExtension",
      id: entry.extensionId,
      version: entry.extensionVersion,
      targets: entry.targets,
      mode: "declarative",
      componentTree: { component: "standard.text", properties: { text: `${entry.extensionId} is unavailable on this device.` } },
      actions: [],
      accessibility: { label: `${entry.extensionId} unavailable`, description: "This Mini App does not support the current client target.", liveRegion: "polite" },
      localization: { defaultLocale: "en", messages: { en: {} } },
      fallbackComponent: entry.fallbackComponent,
      propertiesSchemaVersion: 1,
      eventsSchemaVersion: 1,
    };
    return Object.freeze({
      extension,
      artifactDigest: entry.artifactDigest,
      publisher: entry.publisher,
      isFallback: true,
      activatedAt: new Date().toISOString(),
    });
  }

  private validateActions(extension: ClientExtension): void {
    if (extension.actions.length > 64) throw new Error("Extension declares too many actions.");
    const identifiers = new Set<string>();
    for (const action of extension.actions) {
      if (!/^[a-z][a-z0-9]*(?:[.-][a-z][a-z0-9-]*)+$/.test(action.id) || identifiers.has(action.id) ||
          !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(action.handlerModule) ||
          !Number.isSafeInteger(action.payloadSchemaVersion) || action.payloadSchemaVersion < 1) {
        throw new Error("Extension action declaration is invalid or duplicated.");
      }
      identifiers.add(action.id);
    }
  }

  private validateWasm(value: string | undefined): void {
    if (value === undefined) throw new Error("WASM extension payload is missing.");
    let length: number;
    try { length = Uint8Array.from(atob(value), character => character.charCodeAt(0)).byteLength; }
    catch { throw new Error("WASM extension payload is not valid Base64."); }
    if (length === 0 || length > this.policy.maximumWasmBytes) throw new Error("WASM extension payload exceeds the configured limit.");
  }

  private sameTargets(left: readonly ClientTarget[], right: readonly ClientTarget[]): boolean {
    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => value === sortedRight[index]);
  }
}
