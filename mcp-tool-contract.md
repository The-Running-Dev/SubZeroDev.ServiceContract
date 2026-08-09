# The MCP Tool Contract

**Document status:** Current, not vision. Moved here from `SubZeroDev.Platform`'s
`docs/docs/mcp-tool-contract.md` — S2 gave this repository a generator and a home for the
boundary contract it describes, so the document that names the boundary belongs beside it rather
than in the workload's own docs tree.

> **Where the implementation lives.** `McpTools`
> ([`src/engine/src/mcp/server.ts`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/src/engine/src/mcp/server.ts))
> implements this table exactly, inside the engine repo — it wraps that repo's own
> `SessionStore` directly, has no runtime dependency, and is tested end to end there
> (`TODO.md` W17). This document is the contract; the engine repo is where it's proven.
> The hosted transport that serves these tools over the wire is `SubZeroDev.Platform`'s
> `workloads/game-service/` MCP surface (S6) — see that repository's `design/` set.

## The tool table

The MCP server is a **client**, a sibling of the text client — a thin adapter over the
same session store, holding no game logic. Each tool is one store operation. There is no
AI-specific game path.

| Tool | Args | Returns |
|---|---|---|
| `list_campaigns` | `{}` | `CampaignSummary[]` |
| `start_game` | `{ campaignId, seed?, profileId? }` | `{ sessionId, scene: Scene }` |
| `continue_game` | `{ sessionId }` | `Scene` |
| `get_scene` | `{ sessionId }` | `Scene` |
| `get_state` | `{ sessionId }` | `PlayerView` |
| `get_strings` | `{ sessionId }` | `StringTable` — resolve `LocKey`s |
| `choose` | `{ sessionId, actionId, params? }` | `SessionActionResult` — carries the new `Scene`, never the raw envelope |
| `save_game` | `{ sessionId }` | `{ saveId }` |
| `load_game` | `{ saveId }` | `{ sessionId, scene: Scene }` |
| `preview_action` | `{ sessionId, actionId, params? }` | `SessionActionResult` — resolves, projects, and discards; nothing is persisted |

`choose` is `submitAction` — "choose" is the MCP-facing name for submitting an action,
whatever the kind. Returns and args are the platform types above; no schema is
AI-specific. An agent that can call these tools plays the identical game a browser does.

`start_game`'s args are exactly `{ campaignId, seed?, profileId? }` — deliberately
narrower than the engine's own `CreateSessionConfig`, which also carries `audience`. An
MCP caller choosing `audience: "ai"` would widen its own projection through every later
`get_state` call, breaking the rule below. `McpTools` enforces this by never accepting
the field at all, not by trusting a caller to omit it.

`preview_action` is the tenth operation, added to this table by G1's S2 — the engine's
`main` branch pins ten `SessionStore` operations (`SubZeroDev.Platform`'s
`design/90-decisions.md`, 2026-08-08), and this table's row set is authored against that
exact set (`src/rows.ts`).

## MCP is a sibling, not a special case

The MCP server is a client like the text client — a thin adapter over the same store,
holding no game logic. Every rule the engine repo's client contract states applies to it
unchanged.

The one thing worth stating because it is easy to get wrong: **an agent playing through
MCP is a player.** It receives the same projection, is subject to the same requirement
gating, and gets the same `unknown_action` for a hidden choice. There is no privileged
view, no richer state, and no tool that reveals more than a human client can see. If an
agent could see further, the projection boundary would be a client-side convention
rather than an engine guarantee.
