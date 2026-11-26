# Vendored engine tarball — a stand-in, not the real resolution path

`the-running-dev-game-engine-0.15.0.tgz` is the
[`SubZeroDev.GameEngine`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine) package at the
[`v0.15.0`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/releases/tag/v0.15.0) tag,
commit
[`b7517d8`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/b7517d8d8efb836422085fa1b5bb12057ffa4c04)
(`src/engine`, `npm pack`, which runs the package's own `prepack` → `tsc -p tsconfig.build.json`).
Its sha256 is `e3da18ddcfa84e1f9aa3b210904fa787636a62c85935b5c8f179aac84ea34d70` (sha1
`72ec86ca6cabb35cc7c353764cd0a4a9d4491e1d`).

**This one is published.** `0.15.0` is on GitHub Packages, and its release workflow (run
`45878037211`) re-packed the tagged commit and recorded this same sha256 before publishing it. The
file here was fetched from GitHub Packages itself (`npm pack @the-running-dev/game-engine@0.15.0`),
so it is the published archive, not a local re-pack of it. Same footing as `0.14.0`: a
CI-credential workaround only.

**What changed at `0.15.0`, for this contract's purposes:**

- **`SessionStore` operations — nothing.** The thirteen operations, their argument shapes and the
  ten `SessionStoreErrorCode`s are as they were at `0.10.0`. The RPC contract differs from
  `0.9.0`'s only in `engineVersion`, so `contractVersion` moves to `0.10.0` only because the
  engine pin moved (as at `0.7.0` and `0.9.0`).
- **The content-document contract — two additive, optional shapes.** The engine's published
  attachments (its S141) reach both documents:
  - `PortableManifest` gains `attachments?`: an array of `PortableCampaignAttachment`, each naming
    a story-graph `hostCampaignId`, the `include` that composes the attached campaign into it,
    and the `payload` (a `hostNodeId` and a choice without `goto` or `effects`) that offers it.
  - The story-graph campaign gains `includes?`: an array of `PortableStoryGraphInclude`
    (`alias`, `ref`, and a `binding` whose `exits` are required).

  Both are optional, so every document valid at `0.1.0` is still valid; the content contract's
  own `contractVersion` moves `0.1.0` → `0.2.0` for them, the first time it has moved. The
  document list is unchanged and `formatVersion` is still `2`, so `contentRoot` still ends in
  `v2`. Three definition names carry a generator structure hash that moved with the engine's
  source, as at every bump.
- **What else `0.15.0` adds** — the `reserved_version_identifier` refusal, the `+att.<12hex>`
  version stamp on a campaign an attachment reaches, and one new `getStrings` key — is engine
  behaviour at registry build, not a document shape or a `SessionStore` operation, so nothing here
  projects it.

**Still a stand-in for GitHub Packages, and for the same narrow reason as before.** What is
missing is a GitHub Packages read token in this repository's CI, so the `file:` devDependency
continues to stand in for the registry reference. Vendoring buys the property it always did:
arity, schema projection, and `EngineResolutionFailed` all run against real package resolution
rather than a mock.

**Follow-up, not this PR's to close:** configure a GitHub Packages read token for CI, then replace
this `devDependency` with the plain registry reference `@the-running-dev/game-engine@0.15.0` and
delete this file.

**Note on the registry's version list:** GitHub Packages holds `0.4.0`, `0.5.0`, `0.8.0`,
`0.12.0`, `0.13.0`, `0.14.0` and `0.15.0`. There is no published `0.6.x`, `0.7.x`, `0.9.x` or
`0.10.x`.
