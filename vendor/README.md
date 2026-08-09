# Vendored engine tarball — a stand-in, not the real resolution path

`the-running-dev-game-engine-0.5.0.tgz` is `npm pack` output from
[`SubZeroDev.GameEngine`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine) `main` at
commit `d81bd17`, the release S1 cuts.

**This is a stand-in.** The engine's `package.json` declares
`publishConfig.registry: https://npm.pkg.github.com`, and S2's implementer had no GitHub Packages
token and no tag or release past `v0.4.0` to resolve against. Vendoring the tarball as a `file:`
devDependency lets S2's generator resolve a real, installable package — arity, schema projection,
and `EngineResolutionFailed` all run against real package resolution, not a mock — without that
credential.

**Follow-up, not S2's to close:** publish `SubZeroDev.GameEngine@0.5.0` to GitHub Packages for real
(a version bump and a tag are already in place on `main`), then swap this `devDependency` for the
registry reference and delete this file. Tracked as a gap in the S2 PR description.
