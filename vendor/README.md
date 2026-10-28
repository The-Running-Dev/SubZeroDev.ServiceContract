# Vendored engine tarball — a stand-in, not the real resolution path

`the-running-dev-game-engine-0.12.0.tgz` is the
[`SubZeroDev.GameEngine`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine) package built
from the `0.12.0` release candidate at commit
[`9143836`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/914383610dc2afbb26fe2e224206dbf0a7b2d9e4)
on `release/0.12.0-candidate` (`src/engine`, `npm pack`, which runs the package's own `prepack` →
`tsc -p tsconfig.build.json`). Its sha256 is
`e76fbf5d5c0ea97ea0168be0c23100f840ae366f1bb17a32936ab7e7e22d7f63` (sha1
`81a9e28a45d277d28282638599a691efe419ad50`); `npm pack` is byte-reproducible, so re-packing that
commit reproduces the file exactly, and that re-pack is how this claim is checked.

**This one is `npm pack` output of a candidate, not a published artifact.** `0.12.0` is not
published to GitHub Packages at the time of writing, so there is no registry `dist.shasum` to
verify against and the reproducible re-pack above is the strongest check available — the same
footing `0.10.0`, the pin this replaces, stood on. If the candidate is superseded before it is
tagged, this tarball is re-vendored from the commit that is.

**What changed at `0.12.0`, for this contract's purposes:**

- **`SessionStore` — nothing.** The thirteen operations, their argument shapes and the ten
  `SessionStoreErrorCode`s are as they were at `0.10.0`; regenerating `dist/contract.json` moves
  only `contractVersion` and `engineVersion`. The engine's two `0.12.0` persistence breaks — a
  required `revision` on `StoredSessionRecord`, and `PlayerProfile` `formatVersion: 3` with
  `kindData` — are on the host ports (`SessionPersistence`, `ProfileStore`), not on
  `SessionStore`, so neither is projected here. They are a host adapter's concern.
- **The content-document contract's campaign schema.** `portable/format.d.ts` moved, so the
  generated schema for one document moves with it. Added definitions: `story_graph__ModuleInterface`,
  `simulation__NPCMemory`, `simulation__SimulationNeedDeltas`, `simulation__EvictionStage`, and
  two `Partial<Record<…, number>>` helpers. `story_graph__StoryGraphCampaign` gains `module`,
  `story_graph__Consequence` gains a `copy` op, and `SimulationCampaign`, `HousingDefinition` and
  `NPCDefinition` change shape. The document list is unchanged and `formatVersion` is still `2`,
  so `contentRoot` still ends in `v2`.

**Still a stand-in for GitHub Packages, and for the same narrow reason as before.** What is
missing is a GitHub Packages read token in this repository's CI, so the `file:` devDependency
continues to stand in for the registry reference. Vendoring buys the property it always did:
arity, schema projection, and `EngineResolutionFailed` all run against real package resolution
rather than a mock.

**Follow-up, not this PR's to close:** publish `0.12.0` to GitHub Packages, configure a read token
for CI, then replace this `devDependency` with the plain registry reference
`@the-running-dev/game-engine@0.12.0` and delete this file.

**Note on the registry's version list:** GitHub Packages holds `0.4.0`, `0.5.0`, and `0.8.0`.
There is no published `0.6.x`, `0.7.x`, `0.9.x`, `0.10.x` or `0.12.x`; the `0.6.1`, `0.10.0` and
`0.12.0` pins existed only as the tarball committed to this directory.
