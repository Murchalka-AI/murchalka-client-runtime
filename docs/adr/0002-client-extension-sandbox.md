# ADR 0002: Client extension verification and sandbox

Status: Accepted

## Decision

Web and Desktop shells embed one TypeScript Client Runtime. Runtime publishes only artifacts from active, Root-verified module bundles through a loopback content-addressed catalog. Each client independently verifies the artifact digest and the ECDSA P-256 extension signature against the installation trust projection before caching or activation.

Declarative extensions use a closed standard component vocabulary and DOM text nodes. WASM runs in a disposable Worker with no network, filesystem, database, or secret host functions; worker termination enforces deadlines and declared imports meter host-call fuel. Memory, artifact, tree, and action payload sizes are bounded. Every action is sent through the authenticated realtime module and is validated again by a granted server-side handler.

Catalog activation is atomic. A failed download, signature, schema, target, accessibility, expiration, or sandbox check retains the prior revision. Disable and rollback remove the artifact from the catalog immediately. Verified offline cache entries are keyed by digest and re-hashed before reuse.

## Consequences

Feature modules can add Mini Apps without rebuilding shells. Native OS access remains outside arbitrary client code and must use generic Client or Node capabilities. Pure WebAssembly compute cannot be pre-empted on the renderer thread, so it is never executed there; terminating the Worker is the hard execution boundary.
