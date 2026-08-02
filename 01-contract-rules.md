# Contract Rules

**Status:** Current. These are the operative rules for every boundary contract in this repository.

The reasoning behind them is
[ADR-005](https://github.com/The-Running-Dev/SubZeroDev.Platform/blob/main/docs/docs/adr/ADR-005-service-contract.md)
in `SubZeroDev.Platform`, and is not restated here — one home per rule, referenced rather than
copied.

---

## 1. Projected, never authored

**A contract is generated from whatever owns the types.** Where a boundary's types live in
TypeScript, the wire schema is emitted from those types; where they live in C#, from those.

A schema in this repository is an **artifact of a build step**, committed so consumers can pin it,
not a document a person maintains.

> **Why this is rule 1.** A hand-authored schema is a second definition of types some codebase
> already owns, and the two drift. That is the SubZeroDev ecosystem's dominant recorded failure:
> two byte-identical specification copies drifted under two directory names; two documents
> described one plugin and disagreed about exit codes in a way that would have recorded
> authentication failures as partial successes. The projection rule exists so the boundary cannot
> join that list.

**A hand-written schema "just for now" is how this rule is lost.** If a boundary arrives before its
generator does, the honest options are to write the generator or to leave the contract undeclared —
not to author the schema and intend to replace it.

## 2. MCP is a projection, not the substrate

MCP is a transport whose surface is **projected from a contract**, as the ecosystem's own MCP
decision fixes for plugins. It is not the service-to-service protocol.

Using it as the substrate would conflate the AI-facing surface with internal contracts, and forfeit
the projection property that decision exists to protect. A boundary may well *have* an MCP
projection — the Game Engine already does — but the contract is what the projection comes from.

## 3. JSON over HTTP is the first wire

With schemas published at **version-pathed URLs**, so a consumer pins a version rather than a
moving target.

**protobuf is not chosen, and not rejected forever.** It was declined because it would add a second
serialization format alongside the JSON the Game Engine already emits, and because a hand-authored
`.proto` would violate rule 1. **Revisit when a boundary needs streaming, batch throughput, or
payloads where JSON's size is measurable** — and generate it rather than author it when that
happens.

## 4. Semantic versioning, with pathed schemas

Each contract versions independently. A `2.0` schema is published at a different path from `1.0`,
so it cannot overwrite a pinned reference — the same discipline
[SubZeroDev.PluginContract](https://github.com/The-Running-Dev/SubZeroDev.PluginContract) uses for
its manifest and result-envelope schemas.

**A major version is a stability claim.** Do not reach `1.0.0` on a contract whose generator has
never rejected anything: a schema that has never failed is not known to constrain anything.

## 5. What belongs here, and what does not

| Here | Not here |
|---|---|
| Contracts between products that run as separate processes | Contracts between a host and its plugins — that is `SubZeroDev.PluginContract` |
| The schemas consumers pin, and the rules above | Any product's internal types |
| Versioning and compatibility policy for those contracts | Implementation of either side |

**This repository depends on nothing**, and that is checkable: a dependency added here is a defect,
because every product depends on this and a cycle would follow.
