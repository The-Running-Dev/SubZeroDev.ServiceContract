# Vendored engine tarball — a stand-in, not the real resolution path

`the-running-dev-game-engine-0.10.0.tgz` is the
[`SubZeroDev.GameEngine`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine) package built
from `main` at commit
[`b7e21e7`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/b7e21e712a1e72e32d327ecebac72a2af1c27ebd)
(`src/engine`, `npm pack`, which runs the package's own `prepack` → `tsc -p tsconfig.build.json`).
Its shasum is `e0778c8b9c586bc8611145a0b00df312db9034ef`; `npm pack` is byte-reproducible, so
re-packing that commit reproduces the file exactly, and that re-pack is how this claim is checked.

**This one is `npm pack` output, not a published artifact — a step back from `0.8.0`, and worth
naming rather than glossing.** `0.8.0`, the predecessor here, *was* published: it came off GitHub
Packages and was byte-verified against the registry's own `dist.shasum`. `0.10.0` is not published
to GitHub Packages at the time of writing, so there is no registry `dist.shasum` to verify against
and the reproducible re-pack above is the strongest check available. This is the same footing
`0.6.1` stood on two re-vendors ago. It is a weaker guarantee, and it is the honest one: the
alternative is projecting this contract from an engine surface that has no artifact at all.

**What changed at `0.10.0`, for this contract's purposes** — two units, both landed since `0.8.0`:

- **W98 — Catalog and Projection Completeness** (engine PR #414, contract gate #411) rewrites
  `listCampaigns`. It was `listCampaigns(): CampaignSummary[]`; it is now
  `listCampaigns(profileId?: string): Promise<CampaignCatalog>` — asynchronous, session-free, and
  returning the campaigns together with the `StringTable` that resolves their `titleKey`s
  (`20-contract.md` §7.3 upstream). `CampaignSummary` gains an optional `progress`, present iff a
  `profileId` was supplied. **The operation count does not move**; the shape of one operation does.
- **W99 — Session Lifecycle Operations** (engine PR #416, contract gate #415) adds three
  operations — `listSaves`, `deleteSave`, `branchSession` (§7.4) — taking `SessionStore` from ten
  to thirteen, and adds a tenth `SessionStoreErrorCode`, `invalid_fork_point`. `StoredSaveRecord`
  gains `savedAt`, and `SaveRecordStore` gains `listByProfile` and a conditional `delete`; neither
  is projected here, because neither is on `SessionStore`.

`portable/format.d.ts` also moved — the simulation campaign arm gained an optional `migration`
member (W102) — so the content-document contract's campaign schema changes with it. Its
`formatVersion` is still `2`, so `contentRoot` still ends in `v2`.

**Still a stand-in for GitHub Packages, and for the same narrow reason as before.** What is
missing is a GitHub Packages read token in this repository's CI, so the `file:` devDependency
continues to stand in for the registry reference. Vendoring buys the property it always did:
arity, schema projection, and `EngineResolutionFailed` all run against real package resolution
rather than a mock.

**Follow-up, not this PR's to close:** publish `0.10.0` to GitHub Packages, configure a read token
for CI, then replace this `devDependency` with the plain registry reference
`@the-running-dev/game-engine@0.10.0` and delete this file. Unlike at `0.8.0`, that is no longer
purely a credentials task — the package has to exist first.

**Note on the registry's version list:** GitHub Packages holds `0.4.0`, `0.5.0`, and `0.8.0`.
There is no published `0.6.x`, `0.7.x`, `0.9.x` or `0.10.x`; the `0.6.1` two re-vendors ago and
the `0.10.0` here existed only as the tarball committed to this directory.
