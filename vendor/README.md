# Vendored engine tarball — a stand-in, not the real resolution path

`the-running-dev-game-engine-0.14.0.tgz` is the
[`SubZeroDev.GameEngine`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine) package at the
[`v0.14.0`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/releases/tag/v0.14.0) tag,
commit
[`b7f9925`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/b7f9925f260959ec02fa874555a45482eb63ab49)
(`src/engine`, `npm pack`, which runs the package's own `prepack` → `tsc -p tsconfig.build.json`).
Its sha256 is `43aa787484ce6ed0418775577cd964831a203e3b2504f26a3dd2df5c87eb90f4` (sha1
`bb6a0c3ac320f52d8ff404ab1ec4f1695bcafcf1`).

**This one is published.** `0.14.0` is on GitHub Packages, and its release workflow (run
`41686904892`) re-packed the tagged commit and recorded this same sha256 before publishing it, so
the tarball here is byte-identical to the published archive. Same footing as `0.13.0`: a
CI-credential workaround only.

**What changed at `0.14.0`, for this contract's purposes:**

- **`SessionStore` operations — nothing.** The thirteen operations, their argument shapes and the
  ten `SessionStoreErrorCode`s are as they were at `0.10.0`. The RPC contract's schemas are
  byte-identical to `0.8.0`'s apart from `engineVersion`, so `contractVersion` moves to
  `0.9.0` only because the engine pin moved (as at `0.7.0`).
- **The content-document contract — nothing but `engineVersion`.** The document list is unchanged
  and `formatVersion` is still `2`, so `contentRoot` still ends in `v2`. Three definition names
  carry a generator structure hash that moved with the engine's source; their bodies do not differ.
- **What `0.14.0` does add** — new `unexpected_params` / `unknown_target` action refusals, the
  capture and record-sink types at the package root, and `createReplayContext` — is on the kinds
  and the host ports, not on `SessionStore`, so nothing here projects it.

**Still a stand-in for GitHub Packages, and for the same narrow reason as before.** What is
missing is a GitHub Packages read token in this repository's CI, so the `file:` devDependency
continues to stand in for the registry reference. Vendoring buys the property it always did:
arity, schema projection, and `EngineResolutionFailed` all run against real package resolution
rather than a mock.

**Follow-up, not this PR's to close:** configure a GitHub Packages read token for CI, then replace
this `devDependency` with the plain registry reference `@the-running-dev/game-engine@0.14.0` and
delete this file.

**Note on the registry's version list:** GitHub Packages holds `0.4.0`, `0.5.0`, `0.8.0`,
`0.12.0`, `0.13.0` and `0.14.0`. There is no published `0.6.x`, `0.7.x`, `0.9.x` or `0.10.x`.
