# Vendored engine tarball — a stand-in, not the real resolution path

`the-running-dev-game-engine-0.8.0.tgz` is the published
[`SubZeroDev.GameEngine`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine) `0.8.0`
artifact, downloaded from GitHub Packages and byte-verified against the registry's own
`dist.shasum` (`3c6508e88637d875d5ecdbece162d568495f3727`).

**What changed at `0.8.0`, for this contract's purposes:** `SessionStoreErrorCode` gained a ninth
member, `concurrent_modification`, and the root barrel now also exports
`SESSION_PERSISTENCE_CONFLICT` and `SessionPersistenceConflict` — the brand a host raises to signal
that another writer changed the same session. `SessionStore`'s own declaration and
`portable/format.d.ts` are byte-identical to `0.6.1`, so neither the RPC operation set nor the
content document schemas move; the ninth code is the whole of the projected difference.

**This is still a stand-in for GitHub Packages, but for a narrower reason than before.** The
predecessor here, `0.6.1`, was built with `npm pack` from a commit on `main` and was *never
published anywhere* — vendoring was the only way to resolve it at all. `0.8.0` is published, and is
the registry's `latest`. What remains missing is a GitHub Packages token in this repository's CI, so
the `file:` devDependency continues to stand in for the registry reference. Vendoring still buys the
same property it always did: arity, schema projection, and `EngineResolutionFailed` all run against
real package resolution rather than a mock.

**Follow-up, not this PR's to close:** configure a GitHub Packages read token for CI, then replace
this `devDependency` with the plain registry reference `@the-running-dev/game-engine@0.8.0` and
delete this file. That follow-up is now purely a credentials task — the package it needs already
exists.

**Note on the registry's version list:** GitHub Packages holds `0.4.0`, `0.5.0`, and `0.8.0`. There
is no published `0.6.x` or `0.7.x`; the `0.6.1` this replaces existed only as the tarball formerly
committed here.
