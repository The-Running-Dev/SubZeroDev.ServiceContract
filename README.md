# SubZeroDev.ServiceContract

The contract between SubZeroDev products that run as separate processes.

**Depended on by products; depends on nothing.** That dependency shape is why it is its own
repository rather than a folder inside Platform — a Node product must be able to consume the
contract without conceptually depending on a .NET framework, exactly as
[SubZeroDev.PluginContract](https://github.com/The-Running-Dev/SubZeroDev.PluginContract) is
separate for the same reason.

```text
        SubZeroDev.ServiceContract
           ↑                    ↑
   .NET products          Node products
   (Platform-hosted)      (the Game Engine)
```

## Status

It was created before its first boundary rather than after, because "extract it when we need it"
is a promise this ecosystem has broken twice — the plugin contract sat in a staging tree until
extracted, and `SubZeroDev.Platform` held two incompatible definitions of itself because neither
had a home forcing the question.

The first boundary — the Game Engine's session surface, ten `SessionStore` operations
(`SubZeroDev.Platform`'s G1 effort, slice S2) — now lives here: [`src/rows.ts`](src/rows.ts) is
the authored table, [`src/generate.ts`](src/generate.ts) is the generator, and
[`mcp-tool-contract.md`](mcp-tool-contract.md) is the tool table, moved from
`SubZeroDev.Platform`'s `docs/docs/`.

The reasoning is
[ADR-005](https://github.com/The-Running-Dev/SubZeroDev.Platform/blob/main/docs/docs/adr/ADR-005-service-contract.md)
in `SubZeroDev.Platform`. This repository states the operative rules and does not restate that
reasoning.

## The rules

See [`01-contract-rules.md`](01-contract-rules.md). In short:

1. **Contracts are projected from their source of truth, never authored alongside it.** A
   checked-in schema is an artifact of a build step, not a document maintained by hand.
2. **MCP is a projection, not the substrate.**
3. **JSON over HTTP is the first wire**, with schemas published at version-pathed URLs.
4. **Semantic versioning**, so a 2.0 schema cannot overwrite a pinned 1.0 reference.

## What is not here yet

- **No real npm publish.** `@subzerodev/service-contract`'s name is fixed (`design/90-decisions.md`
  in `SubZeroDev.Platform`, 2026-08-09), but the `@subzerodev` npm organisation reservation
  (`SubZeroDev.Platform` issue #81) is still open, so this repository has never actually published
  to npm — S2's publish gate is proven against a local, ephemeral registry instead
  (`tests/publish.test.ts`). Publishing for real is a follow-up once #81 closes.
- **No GitHub Packages access to the pinned engine.** The generator resolves
  `@the-running-dev/game-engine@0.5.0` from a vendored tarball (`vendor/`) rather than
  `npm.pkg.github.com`, which needs a token this repository's CI does not yet have configured.
  See `vendor/README.md`.
- **`SubZeroDev.GameEngine`'s own `09-clients.md`** still links the old `SubZeroDev.Platform`
  location — that repository had unrelated uncommitted work in progress when S2 landed, so its
  link update is a deliberate follow-up rather than bundled here.

---

Public, work in progress.
