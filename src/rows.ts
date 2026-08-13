/**
 * The authored row set for the pinned engine (`@the-running-dev/game-engine@0.8.0`, ten
 * `SessionStore` operations — `90-decisions.md`, 2026-08-08, "G1 pins the engine release S1 cuts
 * from `main`"). `operation` and `mcpTool` are authored, not derived: nothing in `SessionStore`'s
 * declaration says `submitAction` is `choose`, and the naming here matches the table already
 * proven in `mcp-tool-contract.md` for the nine pre-existing operations, extended by one entry —
 * `preview_action` — for the tenth, `previewAction`, on the same mechanical pattern the table's
 * unrenamed entries already follow (`get_scene`, `save_game`, `load_game`).
 *
 * `operation` is `storeMethod` in kebab-case, uniformly — this holds for all ten rows, including
 * the three whose `mcpTool` is a deliberate rename (`start_game`, `continue_game`, `choose`),
 * because the wire-facing operation id and the MCP tool name are independent authored columns.
 *
 * `reachableErrors` records which of the engine's `SessionStoreErrorCode`s a row's handler can
 * throw, reasoned from each method's role (a query taking a session id can raise
 * `unknown_session`; only `loadGame` can raise the two migration codes). `storage_failure` is
 * declared and unreachable in G1 (`20-contract.md`) and so is never listed.
 *
 * `concurrent_modification` — the ninth code, added by the engine at `0.8.0` — is listed on
 * exactly the three operations that persist a session record, which is where the engine raises
 * it: its `writeSession` translates a host's `SessionPersistenceConflict` into that code, and
 * only `createSession`, `submitAction`, and `loadGame` call it. `saveGame` writes through
 * `writeSave`, which raises `storage_failure` and never this; `previewAction` persists nothing
 * by contract; `resumeSession` reads.
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
];

/** Every declared `SessionStoreErrorCode` plus every `TransportErrorCode`, and no other entry
 *  (invariant 2). `storage_failure` maps to `503` though unreachable in G1 — the mapping is
 *  required to exist, not to be reachable (`20-contract.md`, "Dispatch — `DispatchFailure`").
 *  `concurrent_modification` maps to `409`: it is a write losing to another writer, which the
 *  caller resolves by re-reading and retrying — the same conflict semantics the other three
 *  `409`s carry, not a `503`'s "the store itself is unavailable". */
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
  { code: code("malformed_payload"), status: 400 as const },
  { code: code("unsupported_version"), status: 404 as const },
  { code: code("unknown_operation"), status: 404 as const },
  { code: code("internal_failure"), status: 500 as const },
];
