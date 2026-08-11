# Vendored engine tarball — a stand-in, not the real resolution path

`the-running-dev-game-engine-0.6.0.tgz` is `npm pack` output from a `SubZeroDev.GameEngine`
working tree at commit `d4771af` — the portable-campaign-format graduation (`src/spike/portable.ts`
→ `src/portable/format.ts`; `campaign.content` becomes a `kindId`-discriminated union;
`formatVersion` 1 → 2). **As of this vendoring, that commit is not yet on `SubZeroDev.GameEngine`'s
`main`** — it exists only in a local working tree pending its own PR. Bumping this content
contract's engine pin ahead of the upstream merge landing is a real ordering risk: if the upstream
PR's review changes the graduated shape, this tarball (and everything projected from it) goes
stale. Re-vendor from the real `main` commit once that PR merges, before relying on this for
anything beyond local development.

**This is still a stand-in for GitHub Packages, independent of the above.** The engine's
`package.json` declares `publishConfig.registry: https://npm.pkg.github.com`, and there is still no
GitHub Packages token configured for this repository's tooling. Vendoring the tarball as a `file:`
devDependency lets the generator resolve a real, installable package — arity, schema projection,
and `EngineResolutionFailed` all run against real package resolution, not a mock — without that
credential.

**Follow-up, not this PR's to close:** publish `SubZeroDev.GameEngine@0.6.0` to GitHub Packages for
real once it has actually merged to `main`, then swap this `devDependency` for the registry
reference and delete this file.
