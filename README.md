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

**A second, structurally different boundary now lives here too:** the campaign JSON
`SubZeroDev.Adventures.Content` publishes and `SubZeroDev.Adventures` fetches at runtime.
[`src/documents.ts`](src/documents.ts) is the authored table (two documents: the manifest a
fetcher reads first, and the campaign document it lists), [`src/generate-content.ts`](src/generate-content.ts)
is the generator, and [`src/content-merge.ts`](src/content-merge.ts) exists for one reason:
the engine's three kinds (story-graph, world-graph, simulation) each declare their own,
unrelated `ComparisonOperator` type, and `ts-json-schema-generator` keys its definitions
dictionary by bare name — requesting a schema for all three kinds in one call throws. Each
kind is projected alone (proven to work) and the three closed schemas are merged into one
`anyOf` document by namespacing their definitions, rather than by renaming anything in the
engine. This keeps the property the content contract's crux gate depends on: one schema, one
`validate()` call, every arm fully closed — content is never validated as "any JSON."

That crux gate is `OpaqueContentPayload` (`src/content-gates.ts`): no arm may resolve
`campaign.content` to the shared, unconstrained `JsonValue` fallback. It is checked
end-to-end, not only unit-level — `tests/generate-content.test.ts` compiles the real
generated schemas with `ajv` and confirms a campaign document with the wrong kind's content
shape is rejected.

The engine's portable campaign format (`src/portable/format.ts` upstream) was graduated out
of spike status specifically so this contract would have a real source of truth to project
from — rule 1 does not tolerate a contract built on a type whose own header says "not a
contract."

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
  `@the-running-dev/game-engine@0.8.0` from a vendored tarball (`vendor/`) rather than
  `npm.pkg.github.com`, which needs a token this repository's CI does not yet have configured.
  Unlike the `0.6.1` this replaces, `0.8.0` *is* published to GitHub Packages — so the tarball is
  now a CI-credential workaround only, not the sole way to obtain the engine. See
  `vendor/README.md`.
- **`SubZeroDev.GameEngine`'s own `09-clients.md`** still links the old `SubZeroDev.Platform`
  location — that repository had unrelated uncommitted work in progress when S2 landed, so its
  link update is a deliberate follow-up rather than bundled here.
- **`contracts.subzerodev.dev` does not resolve.** Every `$id` in both contracts is an
  identifier, not a fetchable URL, for the same reason the npm publish above is not real yet.
  Neither this file nor any code here should be read as claiming those schemas are actually
  served at those addresses.
- **No CI workflow runs any of this.** `.github/` holds only `ISSUE_TEMPLATE/`. Every gate in
  both contracts — the ten `SessionStore` invariants and the eleven content-document ones —
  fires only when a human runs `npm run build && npm test`.
- **The content contract's `contentRoot` field is a judgment call, not an obvious fit for rule
  5's table.** It names where documents are published, which reads like "implementation," not
  "shape" — but a runtime fetcher needs a base URL, and a committed fallback copy needs to know
  what it is a fallback *for*. Kept for now; revisit if it proves to be the wrong home.

---

Public, work in progress.
