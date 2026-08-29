# Murchalka Client Runtime

Universal product-agnostic client protocol and extension host. Phase 7 adds a strict TypeScript runtime shared by Web and Desktop shells: atomic extension catalogs, ECDSA and SHA-256 verification, declarative rendering, networkless worker-isolated WASM, bounded server actions, accessibility fallbacks, and verified offline caching.

The browser-facing package is `@murchalka-ai/client-runtime`. It has no runtime dependencies and exposes only standard Web Platform APIs. The .NET package remains available for native hosts and authenticated realtime protocol access.

```sh
npm ci
npm run check:ts
dotnet restore
dotnet test --no-restore
```

Client extensions are never executed before catalog digest, publisher signature, target, size, expiration, component-tree, localization, and accessibility validation. A catalog revision activates atomically; any failed artifact leaves the prior revision active.

Canonical `vX.Y.Z` tags publish deterministic npm and NuGet packages with provenance and an immutable GitHub Release.
