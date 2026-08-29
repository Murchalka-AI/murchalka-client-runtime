# Security

The client accepts only explicit loopback Runtime and WebSocket endpoints, bounds every artifact and action payload, never stores passwords, and treats every UI action as an untrusted server request.

Extensions require a content-addressed catalog entry and a signature from an installation-trusted ECDSA P-256 publisher key. Declarative content is rendered with DOM text nodes, never HTML. WASM receives no filesystem, secret, database, or network imports and runs inside a disposable Worker with deadline, memory, payload, and host-call fuel limits. Unsupported targets receive an accessible standard fallback. A failed update rolls back to the last fully verified catalog revision; offline activation uses only previously verified digest-keyed bytes.
