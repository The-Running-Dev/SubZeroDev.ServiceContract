# Vendored engine tarball — a stand-in, not the real resolution path

`the-running-dev-game-engine-0.13.0.tgz` is the
[`SubZeroDev.GameEngine`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine) package at the
[`v0.13.0`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/releases/tag/v0.13.0) tag,
commit
[`45b7216`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/45b721693d1b92db86bd128c16ae2c753ace190d)
(`src/engine`, `npm pack`, which runs the package's own `prepack` → `tsc -p tsconfig.build.json`).
Its sha256 is `aa8f4b91bfcb5597786048f8370bb9a2a72066cb9d55d5d90954391a4030dc1c` (sha1
`7342ef43c6ea7846d41a0042fd134d0e5733e394`).

**This one is published.** `0.13.0` is on GitHub Packages, and its release workflow re-packed the
tagged commit and verified this same sha256 before publishing it, so the tarball here is
byte-identical to the published archive. That puts it on the footing `0.8.0` stood on — a
CI-credential workaround only — rather than the candidate-only footing of `0.10.0` and `0.12.0`.

**What changed at `0.13.0`, for this contract's purposes:**

- **`SessionStore` operations — nothing.** The thirteen operations, their argument shapes and the
  ten `SessionStoreErrorCode`s are as they were at `0.10.0`.
- **Validation details on `preview-action` and `submit-action` responses.** `ValidationError.details`
  widens from `Record<string, string | number>` to `Record<string, string | number | boolean>`,
  and `ValidationWarning` gains the same optional `details`. Those are the only schema changes in
  `dist/contract.json`; `contractVersion` moves to `0.8.0` for them.
- **The content-document contract — nothing but `engineVersion`.** The generated campaign schema
  is identical; three definition names carry a generator structure hash that moved with the
  engine's source, but their bodies do not differ. The document list is unchanged and
  `formatVersion` is still `2`, so `contentRoot` still ends in `v2`.

**Still a stand-in for GitHub Packages, and for the same narrow reason as before.** What is
missing is a GitHub Packages read token in this repository's CI, so the `file:` devDependency
continues to stand in for the registry reference. Vendoring buys the property it always did:
arity, schema projection, and `EngineResolutionFailed` all run against real package resolution
rather than a mock.

**Follow-up, not this PR's to close:** configure a GitHub Packages read token for CI, then replace
this `devDependency` with the plain registry reference `@the-running-dev/game-engine@0.13.0` and
delete this file.

**Note on the registry's version list:** GitHub Packages holds `0.4.0`, `0.5.0`, `0.8.0`, `0.12.0`
and `0.13.0`. There is no published `0.6.x`, `0.7.x`, `0.9.x` or `0.10.x`; the `0.6.1` and `0.10.0`
pins existed only as the tarball committed to this directory.
