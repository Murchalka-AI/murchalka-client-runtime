import { describe, expect, it } from "vitest";
import type { ArtifactFetcher } from "../Assets/ArtifactFetcher.js";
import type { ClientExtension } from "../Protocol/ClientExtension.js";
import type { ExtensionCatalogSnapshot } from "../Protocol/ExtensionCatalogSnapshot.js";
import { canonicalJson } from "../Security/CanonicalJson.js";
import { defaultClientSecurityPolicy } from "../Security/defaultClientSecurityPolicy.js";
import { DigestVerifier } from "../Security/DigestVerifier.js";
import { ExtensionSignatureVerifier } from "../Security/ExtensionSignatureVerifier.js";
import { MemoryVerifiedExtensionCache } from "../Offline/MemoryVerifiedExtensionCache.js";
import { ExtensionRegistry } from "./ExtensionRegistry.js";

describe("ExtensionRegistry", () => {
  it("activates a signed extension and reuses its verified offline cache", async () => {
    const fixture = await createFixture();
    let downloads = 0;
    const fetcher: ArtifactFetcher = { fetch: () => { downloads += 1; return Promise.resolve(fixture.bytes); } };
    const cache = new MemoryVerifiedExtensionCache();
    const verifier = new ExtensionSignatureVerifier([fixture.publisher]);
    const first = new ExtensionRegistry("web", fetcher, cache, verifier, defaultClientSecurityPolicy);
    await first.activate(fixture.catalog);
    const second = new ExtensionRegistry("web", fetcher, cache, verifier, defaultClientSecurityPolicy);
    await second.activate({ ...fixture.catalog, revision: 2 });
    expect(first.snapshot().extensions[0]?.extension.id).toBe("client.diagnostics");
    expect(downloads).toBe(1);
  });

  it("keeps the prior revision when a corrupt update fails", async () => {
    const fixture = await createFixture();
    let bytes = fixture.bytes;
    const fetcher: ArtifactFetcher = { fetch: () => Promise.resolve(bytes) };
    const registry = new ExtensionRegistry("web", fetcher, new MemoryVerifiedExtensionCache(), new ExtensionSignatureVerifier([fixture.publisher]), defaultClientSecurityPolicy);
    await registry.activate(fixture.catalog);
    bytes = new TextEncoder().encode("corrupt");
    const broken = { ...fixture.catalog, revision: 2, entries: [{ ...fixture.catalog.entries[0]!, artifactDigest: `sha256:${"0".repeat(64)}` as const }] };
    await expect(registry.activate(broken)).rejects.toThrow(/digest/);
    expect(registry.snapshot().revision).toBe(1);
  });

  it("provides an accessible fallback without downloading an unsupported target", async () => {
    const fixture = await createFixture();
    const fetcher: ArtifactFetcher = { fetch: () => Promise.reject(new Error("must not download")) };
    const registry = new ExtensionRegistry("xr", fetcher, new MemoryVerifiedExtensionCache(), new ExtensionSignatureVerifier([]), defaultClientSecurityPolicy);
    await registry.activate(fixture.catalog);
    expect(registry.snapshot().extensions[0]?.isFallback).toBe(true);
    expect(registry.snapshot().extensions[0]?.extension.accessibility.label).toContain("unavailable");
  });

  it("rejects a signed document whose targets differ from the verified catalog", async () => {
    const fixture = await createFixture();
    const mismatched = { ...fixture.catalog, entries: [{ ...fixture.catalog.entries[0]!, targets: ["web"] as const }] };
    const registry = new ExtensionRegistry("web", { fetch: () => Promise.resolve(fixture.bytes) }, new MemoryVerifiedExtensionCache(), new ExtensionSignatureVerifier([fixture.publisher]), defaultClientSecurityPolicy);
    await expect(registry.activate(mismatched)).rejects.toThrow(/metadata/);
    expect(registry.snapshot().revision).toBe(0);
  });
});

async function createFixture() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const extension: ClientExtension = {
    apiVersion: "client.murchalka.dev/v1",
    kind: "ClientExtension",
    id: "client.diagnostics",
    version: "0.4.0",
    targets: ["web", "desktop"],
    mode: "declarative",
    componentTree: { component: "standard.layout", children: [{ component: "standard.text", properties: { text: "Runtime ready" } }] },
    actions: [],
    accessibility: { label: "Client diagnostics" },
    localization: { defaultLocale: "en", messages: { en: {} } },
    fallbackComponent: "standard.document",
    propertiesSchemaVersion: 1,
    eventsSchemaVersion: 1,
  };
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(canonicalJson(extension))));
  const envelope = { schemaVersion: 1, extension, signature: { algorithm: "ecdsa-p256-sha256", keyId: "test-key", value: toBase64(signature) } };
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  const digest = await new DigestVerifier().compute(bytes);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const catalog: ExtensionCatalogSnapshot = {
    schemaVersion: 1,
    revision: 1,
    generatedAt: new Date().toISOString(),
    entries: [{
      extensionId: extension.id,
      extensionVersion: extension.version,
      moduleId: "dev.murchalka.client-diagnostics",
      moduleVersion: "0.4.0",
      artifactId: "client-diagnostics",
      artifactDigest: digest,
      artifactBytes: bytes.byteLength,
      artifactUrl: `/client/v1/artifacts/${digest.slice(7)}`,
      mode: "declarative",
      targets: extension.targets,
      publisher: "dev.murchalka",
      keyId: "test-key",
      fallbackComponent: extension.fallbackComponent,
    }],
  };
  return { bytes, catalog, publisher: { publisher: "dev.murchalka", keyId: "test-key", publicKeyPem: toPem(spki) } };
}

function toBase64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value));
}

function toPem(value: Uint8Array): string {
  const base64 = toBase64(value).match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
}
