# Vendored engine tarball — a stand-in, not the real resolution path

`the-running-dev-game-engine-0.6.1.tgz` is `npm pack` output from
[`SubZeroDev.GameEngine`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine) `main` at
commit
[`ec92fba`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/ec92fbacfa359df7de5a2c0ff64209c54f76a280) —
the portable-campaign-format graduation (`src/spike/portable.ts` → `src/portable/format.ts`;
`campaign.content` becomes a `kindId`-discriminated union; `formatVersion` 1 → 2), plus a same-PR
follow-up fix at `0.6.1`: `ComparisonCondition.value` went from required to optional, found by this
repository's own content contract validating real published campaign JSON against `0.6.0` — a
required `value` rejected a real achievement condition that legitimately omits it. Both landed via
[GameEngine#294](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/294), rebase-merged.

**This is still a stand-in for GitHub Packages.** The engine's `package.json` declares
`publishConfig.registry: https://npm.pkg.github.com`, and there is still no GitHub Packages token
configured for this repository's tooling. Vendoring the tarball as a `file:` devDependency lets the
generator resolve a real, installable package — arity, schema projection, and
`EngineResolutionFailed` all run against real package resolution, not a mock — without that
credential.

**Follow-up, not this PR's to close:** publish `SubZeroDev.GameEngine@0.6.1` to GitHub Packages for
real, then swap this `devDependency` for the registry reference and delete this file.
