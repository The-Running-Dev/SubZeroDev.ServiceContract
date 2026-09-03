/**
 * The authored row set for the pinned engine (`@the-running-dev/game-engine@0.10.0`, thirteen
 * `SessionStore` operations — the engine's own `09-clients.md` §4 "API Coverage Checklist").
 * `operation` and `mcpTool` are authored, not derived: nothing in `SessionStore`'s declaration
 * says `submitAction` is `choose`, and the naming here matches the table proven in
 * `mcp-tool-contract.md`, which the engine's own `McpTools` interface implements one-to-one.
 *
 * `operation` is `storeMethod` in kebab-case, uniformly — this holds for all thirteen rows,
 * including the three whose `mcpTool` is a deliberate rename (`start_game`, `continue_game`,
 * `choose`), because the wire-facing operation id and the MCP tool name are independent
 * authored columns.
 *
 * **The three rows W99 adds** — `list-saves`, `branch-session`, `delete-save` — are the engine's
 * 04 §7.4 session lifecycle operations. Their `mcpTool` names are not invented here: the
 * engine's `McpTools` already declares `list_saves`, `branch_session` and `delete_save` with
 * exactly these argument shapes, so this table mirrors a name that exists rather than choosing
 * one. The arity gate is what forces them to exist at all — a `SessionStore` method with no row
 * fails the build, which is the arrangement the engine's `20-contract.md` §7.4 cites when it
 * states a count of thirteen and expects to be believed.
 *
 * `reachableErrors` records which of the engine's `SessionStoreErrorCode`s a row's handler can
 * throw. For the ten pre-W99 rows this was reasoned from each method's role; for the three new
 * ones it is read straight off `20-contract.md` §7.4's own "Error semantics" table, which names
 * the raiser, the code, and the condition for each.
 *
 * `storage_failure` is no longer the unreachable-everywhere code it was in G1. §7.4 makes it
 * reachable on exactly the two lifecycle operations whose whole body is an adapter call —
 * `listSaves` and `deleteSave` — and it stays unlisted on every other row, where the engine
 * still has no path that raises it.
 *
 * `concurrent_modification` is listed on the three operations that persist a session record
 * (`writeSession` translates a host's `SessionPersistenceConflict` into it, and only
 * `createSession`, `submitAction` and `loadGame` call it) plus `deleteSave`, which §7.4 gives
 * it for a different reason: a stale `expectedSavedAt` precondition. `previewAction` persists
 * nothing by contract; `resumeSession` reads; `branchSession` writes only a new record and
 * never touches the source (§7.4's B2).
 *
 * `invalid_fork_point` — the tenth `SessionStoreErrorCode`, added by the engine at `0.10.0` —
 * belongs to `branchSession` alone. It is the one code in the vocabulary raised by exactly one
 * operation.
 *
 * `listCampaigns` carries no `reachableErrors` still, and that survived W98's rewrite of it
 * (§7.3) deliberately: the catalog degrades rather than fails — a missing or corrupt profile
 * yields `discovered: 0` and a `ProfileWarning`, never a raised code, because "a player cannot
 * be stopped from browsing campaigns because a progress number could not be read".
 */
import type { AuthoredRow, NarrowedField, WireErrorCode } from "./types.js";

function op(value: string): AuthoredRow["operation"] {
  return value as AuthoredRow["operation"];
}
function method(value: string): AuthoredRow["storeMethod"] {
  return value as AuthoredRow["storeMethod"];
}
function tool(value: string): AuthoredRow["mcpTool"] {
  return value as AuthoredRow["mcpTool"];
}
function code(value: string): WireErrorCode {
  return value as WireErrorCode;
}

const NONE: readonly NarrowedField[] = [];

export const AUTHORED_ROWS: readonly AuthoredRow[] = [
  {
    operation: op("list-campaigns"),
    storeMethod: method("listCampaigns"),
    mcpTool: tool("list_campaigns"),
    narrowings: NONE,
    reachableErrors: [],
  },
  {
    operation: op("get-scene"),
    storeMethod: method("getScene"),
    mcpTool: tool("get_scene"),
    narrowings: NONE,
    reachableErrors: [code("unknown_session")],
  },
  {
    operation: op("get-view"),
    storeMethod: method("getView"),
    mcpTool: tool("get_state"),
    narrowings: NONE,
    reachableErrors: [code("unknown_session")],
  },
  {
    operation: op("get-strings"),
    storeMethod: method("getStrings"),
    mcpTool: tool("get_strings"),
    narrowings: NONE,
    reachableErrors: [code("unknown_session")],
  },
  {
    operation: op("list-saves"),
    storeMethod: method("listSaves"),
    mcpTool: tool("list_saves"),
    narrowings: NONE,
    reachableErrors: [code("storage_failure")],
  },
  {
    operation: op("preview-action"),
    storeMethod: method("previewAction"),
    mcpTool: tool("preview_action"),
    narrowings: NONE,
    reachableErrors: [code("unknown_session"), code("invalid_state")],
  },
  {
    operation: op("create-session"),
    storeMethod: method("createSession"),
    mcpTool: tool("start_game"),
    // `start_game`'s args are `{ campaignId, seed?, profileId? }` — narrower than the engine's own
    // `CreateSessionConfig`, which also carries `audience` (`mcp-tool-contract.md`).
    narrowings: [{ side: "request", field: "audience" }],
    reachableErrors: [code("unknown_campaign"), code("unknown_kind"), code("concurrent_modification")],
  },
  {
    operation: op("resume-session"),
    storeMethod: method("resumeSession"),
    mcpTool: tool("continue_game"),
    narrowings: NONE,
    reachableErrors: [code("unknown_session"), code("invalid_state")],
  },
  {
    operation: op("submit-action"),
    storeMethod: method("submitAction"),
    mcpTool: tool("choose"),
    narrowings: NONE,
    reachableErrors: [code("unknown_session"), code("invalid_state"), code("concurrent_modification")],
  },
  {
    operation: op("save-game"),
    storeMethod: method("saveGame"),
    mcpTool: tool("save_game"),
    // `save_game` returns `{ saveId }`, not the store's `SaveHandle { saveId, savedAtSeq }`
    // (`90-decisions.md`, "the operation table is authored data over derived types").
    narrowings: [{ side: "response", field: "savedAtSeq" }],
    reachableErrors: [code("unknown_session")],
  },
  {
    operation: op("load-game"),
    storeMethod: method("loadGame"),
    mcpTool: tool("load_game"),
    narrowings: NONE,
    reachableErrors: [
      code("unknown_save"),
      code("save_requires_migration"),
      code("migration_failed"),
      code("concurrent_modification"),
    ],
  },
  {
    operation: op("delete-save"),
    storeMethod: method("deleteSave"),
    mcpTool: tool("delete_save"),
    narrowings: NONE,
    // §7.4: a wrong-profile delete and a missing save are one code on purpose — a distinct
    // "not yours" would confirm a `saveId` exists to a caller holding no claim on it.
    reachableErrors: [
      code("unknown_save"),
      code("concurrent_modification"),
      code("storage_failure"),
    ],
  },
  {
    operation: op("branch-session"),
    storeMethod: method("branchSession"),
    mcpTool: tool("branch_session"),
    narrowings: NONE,
    reachableErrors: [
      code("unknown_session"),
      code("invalid_fork_point"),
      code("invalid_state"),
      code("unknown_campaign"),
    ],
  },
];

/** Every declared `SessionStoreErrorCode` plus every `TransportErrorCode`, and no other entry
 *  (invariant 2). `storage_failure` maps to `503`; W99 is what finally made it reachable, on
 *  `listSaves` and `deleteSave`, so the mapping that was required-but-unexercised in G1 now
 *  carries real traffic.
 *  `concurrent_modification` maps to `409`: it is a write losing to another writer, which the
 *  caller resolves by re-reading and retrying — the same conflict semantics the other three
 *  `409`s carry, not a `503`'s "the store itself is unavailable".
 *  `invalid_fork_point` maps to `409` on the same reading. It is not a `400`: the payload is
 *  well-formed and `atActionCount` is a perfectly good number — what it conflicts with is the
 *  source session's actual `actionLog.length`, which is resource state the caller could not
 *  have validated against on its own. That is the distinction `malformed_payload` (`400`)
 *  already draws against `invalid_state` (`409`), and this code sits on the `invalid_state`
 *  side of it. */
export const STATUS_MAPPING_ENTRIES = [
  { code: code("unknown_session"), status: 404 as const },
  { code: code("unknown_save"), status: 404 as const },
  { code: code("storage_failure"), status: 503 as const },
  { code: code("unknown_campaign"), status: 404 as const },
  { code: code("invalid_state"), status: 409 as const },
  { code: code("unknown_kind"), status: 409 as const },
  { code: code("save_requires_migration"), status: 409 as const },
  { code: code("migration_failed"), status: 409 as const },
  { code: code("concurrent_modification"), status: 409 as const },
  { code: code("invalid_fork_point"), status: 409 as const },
  { code: code("malformed_payload"), status: 400 as const },
  { code: code("unsupported_version"), status: 404 as const },
  { code: code("unknown_operation"), status: 404 as const },
  { code: code("internal_failure"), status: 500 as const },
  { code: code("session_expired"), status: 404 as const },
  { code: code("save_expired"), status: 404 as const },
];
