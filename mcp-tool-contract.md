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
| `list_campaigns` | `{ profileId? }` | `CampaignCatalog` — the summaries and the `StringTable` that resolves their `titleKey`s |
| `start_game` | `{ campaignId, seed?, profileId? }` | `{ sessionId, scene: Scene }` |
| `continue_game` | `{ sessionId }` | `Scene` |
| `get_scene` | `{ sessionId }` | `Scene` |
| `get_state` | `{ sessionId }` | `PlayerView` |
| `get_strings` | `{ sessionId }` | `StringTable` — resolve `LocKey`s |
| `choose` | `{ sessionId, actionId, params? }` | `SessionActionResult` — carries the new `Scene`, never the raw envelope |
| `save_game` | `{ sessionId }` | `{ saveId }` |
| `load_game` | `{ saveId }` | `{ sessionId, scene: Scene }` |
| `preview_action` | `{ sessionId, actionId, params? }` | `SessionActionResult` — resolves, projects, and discards; nothing is persisted |
| `list_saves` | `{ profileId }` | `SaveSummary[]` — this profile's saves and no other's, `savedAt` descending then `saveId` ascending |
| `branch_session` | `{ sessionId, atActionCount }` | `{ sessionId, scene: Scene }` — a new session that replays byte-identically through the fork point; the source is untouched |
| `delete_save` | `{ profileId, saveId, expectedSavedAt }` | nothing — removes exactly the addressed record, and refuses a stale `expectedSavedAt` |

`choose` is `submitAction` — "choose" is the MCP-facing name for submitting an action,
whatever the kind. Returns and args are the platform types above; no schema is
AI-specific. An agent that can call these tools plays the identical game a browser does.

`start_game`'s args are exactly `{ campaignId, seed?, profileId? }` — deliberately
narrower than the engine's own `CreateSessionConfig`, which also carries `audience`. An
MCP caller choosing `audience: "ai"` would widen its own projection through every later
`get_state` call, breaking the rule below. `McpTools` enforces this by never accepting
the field at all, not by trusting a caller to omit it.

`preview_action` was the tenth operation, added to this table by G1's S2. The last three —
`list_saves`, `branch_session`, `delete_save` — are the engine's 04 §7.4 session lifecycle
operations (W99), and `list_campaigns`'s args and return type are W98's (04 §7.3): it takes an
optional `profileId` and is asynchronous, where it used to take nothing and return a bare
`CampaignSummary[]` synchronously. The engine pins thirteen `SessionStore` operations at
`0.10.0`, and this table's row set is authored against that exact set (`src/rows.ts`).

**No name in this table is invented here.** The engine's own `McpTools` interface
([`src/engine/src/mcp/server.ts`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/src/engine/src/mcp/server.ts))
declares all thirteen with these argument shapes; this document mirrors what exists rather than
choosing it, and the arity gate in `src/generate.ts` is what keeps the mirror from falling behind
— a `SessionStore` method with no row fails the build.

**`delete_save` is the one tool that returns nothing.** `SessionStore.deleteSave` is
`Promise<void>`, so the projected response schema is `{"type": "null"}` — that is the projection
of `void`, not an authored choice, and `null` is the wire spelling of it. A caller reads the
absence of an error, not a value.

**`list_saves` and `delete_save` take a `profileId` the store never verifies.** It is a scoping
key, not a credential (04 §7.4): authenticating a caller and proving the profile is theirs is the
host's job. An MCP host that forwards a caller-supplied `profileId` unchecked has built a
cross-player read, and the store cannot stop it — it has no notion of a caller to stop it with.

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
