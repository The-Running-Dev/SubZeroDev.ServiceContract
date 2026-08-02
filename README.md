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

**New and nearly empty, deliberately.** It was created before its first boundary rather than
after, because "extract it when we need it" is a promise this ecosystem has broken twice — the
plugin contract sat in a staging tree until extracted, and `SubZeroDev.Platform` held two
incompatible definitions of itself because neither had a home forcing the question.

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

- **No boundary contract.** The first is expected to be the Game Engine's session surface — the
  nine store operations. Its current home is `mcp-tool-contract.md` in `SubZeroDev.Platform`;
  moving it means updating the engine's `09-clients.md`, which links it by URL, so it is a
  deliberate follow-up rather than a silent consequence.
- **No generator.** Rule 1 needs one, and the first boundary pays for it. A hand-written schema
  "just for now" is how rule 1 gets lost.
- **No version tag.** There is nothing to version yet.

---

Public, work in progress.
