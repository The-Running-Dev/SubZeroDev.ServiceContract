/**
 * `generate` — the one entry point. Every gate `20-contract.md` names runs inside it; a gate
 * failure returns a `GenerationError` and writes nothing.
 */
import { resolveEngine, EngineResolutionError } from "./engine-introspect.js";
import { projectSchemas, requestTypeName, responseTypeName, SCHEMA_DIALECT } from "./schema-gen.js";
import { closeSchema } from "./schema-close.js";
import type {
  AuthoredRow,
  ContractPackage,
  GenerationError,
  GenerationInput,
  JsonSchemaDocument,
  OperationRow,
  Outcome,
  SchemaRef,
} from "./types.js";

const KNOWN_ENGINE_ERROR_CODES = [
  "unknown_session",
  "unknown_save",
  "storage_failure",
  "unknown_campaign",
  "invalid_state",
  "unknown_kind",
  "save_requires_migration",
  "migration_failed",
] as const;

const TRANSPORT_ERROR_CODES = ["malformed_payload", "unsupported_version", "unknown_operation"] as const;

function fail(error: GenerationError): Outcome<ContractPackage, GenerationError> {
  return { ok: false, error };
}

function majorVersion(semver: string): string {
  return semver.split(".")[0] ?? "0";
}

function schemaRef(wireVersion: string, operation: string, side: "request" | "response"): SchemaRef {
  return `https://contracts.subzerodev.dev/service-contract/${wireVersion}/${operation}/${side}.json` as SchemaRef;
}

/** True if `node` (a closed schema, possibly `$ref`-ing into `definitions`) reaches a definition
 *  named `GameState` anywhere in its `$ref` closure — the engine's raw envelope type, which no
 *  response schema may resolve to (invariant 3, `EnvelopeReachable`). */
function reachesEnvelope(schema: Record<string, unknown>): boolean {
  const definitions = (schema["definitions"] ?? {}) as Record<string, unknown>;
  if ("GameState" in definitions) return true;
  const seen = new Set<string>();
  const visit = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(visit);
    if (node === null || typeof node !== "object") return false;
    const record = node as Record<string, unknown>;
    const ref = record["$ref"];
    if (typeof ref === "string") {
      const name = ref.replace("#/definitions/", "");
      if (name === "GameState") return true;
      if (!seen.has(name) && name in definitions) {
        seen.add(name);
        if (visit(definitions[name])) return true;
      }
    }
    return Object.values(record).some(visit);
  };
  return visit(schema);
}

export function generate(input: GenerationInput): Promise<Outcome<ContractPackage, GenerationError>> {
  return Promise.resolve(generateSync(input));
}

function generateSync(input: GenerationInput): Outcome<ContractPackage, GenerationError> {
  let engine;
  try {
    engine = resolveEngine(process.cwd());
  } catch (error) {
    if (error instanceof EngineResolutionError) {
      return fail({ code: "EngineResolutionFailed", packageName: error.packageName, registry: error.registry });
    }
    throw error;
  }

  // Invariant 1 — arity: the row set exactly covers the engine's exported methods.
  const engineMethodNames = new Set(engine.methods.map((m) => m.name));
  const rowMethodNames = new Set(input.rows.map((r) => r.storeMethod as string));
  for (const name of engineMethodNames) {
    if (!rowMethodNames.has(name)) {
      return fail({ code: "ArityMismatch", method: name });
    }
  }
  for (const row of input.rows) {
    if (!engineMethodNames.has(row.storeMethod as string)) {
      return fail({ code: "ArityMismatch", operation: row.operation as string });
    }
  }

  // Invariant 6 — no duplicate OperationId or McpToolName.
  const seenOperations = new Map<string, AuthoredRow>();
  const seenTools = new Map<string, AuthoredRow>();
  for (const row of input.rows) {
    const opKey = row.operation as string;
    const toolKey = row.mcpTool as string;
    const opClash = seenOperations.get(opKey);
    if (opClash) return fail({ code: "DuplicateOperationId", first: opClash.operation as string, second: opKey });
    const toolClash = seenTools.get(toolKey);
    if (toolClash) return fail({ code: "DuplicateOperationId", first: toolClash.mcpTool as string, second: toolKey });
    seenOperations.set(opKey, row);
    seenTools.set(toolKey, row);
  }

  // Determinism-profile-in-row (invariant 5): defensive runtime check — `AuthoredRow`'s type
  // carries no such member, but a hand-edited or dynamically-built row object could still smuggle
  // one in, and this is the gate that catches it before it reaches an artifact.
  const FORBIDDEN_ROW_KEYS = ["determinism", "determinismProfile", "profile"];
  for (const row of input.rows) {
    for (const key of FORBIDDEN_ROW_KEYS) {
      if (key in row) {
        return fail({ code: "DeterminismProfileInRow", operation: row.operation as string });
      }
    }
  }

  // Invariant 2 — status mapping exactly covers every declared engine code and every transport
  // code, and nothing else.
  const requiredCodes = new Set<string>([...KNOWN_ENGINE_ERROR_CODES, ...TRANSPORT_ERROR_CODES]);
  const mappedCodes = new Set(input.statusMapping.entries.map((e) => e.code as string));
  for (const required of requiredCodes) {
    if (!mappedCodes.has(required)) {
      return fail({ code: "ErrorCodeUncovered", wireErrorCode: required });
    }
  }
  for (const mapped of mappedCodes) {
    if (!requiredCodes.has(mapped)) {
      return fail({ code: "ErrorCodeUncovered", wireErrorCode: mapped });
    }
  }

  // Project schemas from the engine's own types (rule 1), then close and narrow each one.
  const rawSchemas = projectSchemas(process.cwd(), engine.methods, engine.distRoot);
  const schemas: JsonSchemaDocument[] = [];
  const operations: OperationRow[] = [];

  for (const row of input.rows) {
    const requestRaw = rawSchemas.get(requestTypeName(row.storeMethod as string));
    const responseRaw = rawSchemas.get(responseTypeName(row.storeMethod as string));
    if (!requestRaw || !responseRaw) {
      return fail({ code: "ArityMismatch", operation: row.operation as string });
    }

    const requestNarrowFields = row.narrowings.filter((n) => n.side === "request").map((n) => n.field);
    const responseNarrowFields = row.narrowings.filter((n) => n.side === "response").map((n) => n.field);

    // Invariant 7 — a narrowing must name a member the engine's declaration actually has.
    for (const field of requestNarrowFields) {
      if (!hasTopLevelMember(requestRaw, field)) {
        return fail({ code: "NarrowingUnknownField", operation: row.operation as string, field });
      }
    }
    for (const field of responseNarrowFields) {
      if (!hasTopLevelMember(responseRaw, field)) {
        return fail({ code: "NarrowingUnknownField", operation: row.operation as string, field });
      }
    }

    const requestClosed = closeSchema(requestRaw, { narrowFields: requestNarrowFields });
    const responseClosed = closeSchema(responseRaw, { narrowFields: responseNarrowFields });

    if (!isFullyClosed(requestClosed)) {
      return fail({ code: "RequestSchemaOpen", schema: `${row.operation as string}/request` });
    }
    if (!isFullyClosed(responseClosed)) {
      return fail({ code: "ResponseSchemaOpen", schema: `${row.operation as string}/response` });
    }
    if (reachesEnvelope(responseClosed)) {
      return fail({ code: "EnvelopeReachable", schema: `${row.operation as string}/response` });
    }

    const requestShape = schemaRef(input.wireVersion as string, row.operation as string, "request");
    const responseShape = schemaRef(input.wireVersion as string, row.operation as string, "response");

    schemas.push({ $id: requestShape, $schema: SCHEMA_DIALECT as JsonSchemaDocument["$schema"], ...requestClosed });
    schemas.push({ $id: responseShape, $schema: SCHEMA_DIALECT as JsonSchemaDocument["$schema"], ...responseClosed });

    // Invariant 4 — httpPath equals operation, verbatim. Mechanical, so always true; asserted
    // structurally by construction rather than checked and possibly failed.
    operations.push({
      ...row,
      httpPath: row.operation as unknown as OperationRow["httpPath"],
      requestShape,
      responseShape,
    });
  }

  const contract: ContractPackage = {
    contractVersion: input.contractVersion,
    engineVersion: input.engineVersion,
    wireVersion: input.wireVersion,
    operations,
    schemas,
    statusMapping: input.statusMapping,
  };

  return { ok: true, value: contract };
}

function hasTopLevelMember(raw: Record<string, unknown>, field: string): boolean {
  const definitions = (raw["definitions"] ?? {}) as Record<string, unknown>;
  const root = resolveRoot(raw, definitions);
  const properties = (root?.["properties"] ?? {}) as Record<string, unknown>;
  return field in properties;
}

function resolveRoot(
  raw: Record<string, unknown>,
  definitions: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (typeof raw["$ref"] === "string") {
    const name = (raw["$ref"] as string).replace("#/definitions/", "");
    return definitions[name] as Record<string, unknown> | undefined;
  }
  return raw;
}

/** Every `type: "object"` node in the closed schema either declares `additionalProperties: false`
 *  or constrains additional properties to a value schema (a legitimate map type, e.g. `StringTable`
 *  — every key must still satisfy that schema, so it is closed in the sense this gate cares about:
 *  no arbitrary, unvalidated member can pass through). Only `true` or an absent keyword — meaning
 *  literally any extra member is accepted — counts as open. */
function isFullyClosed(node: unknown): boolean {
  if (Array.isArray(node)) return node.every(isFullyClosed);
  if (node === null || typeof node !== "object") return true;
  const record = node as Record<string, unknown>;
  if (record["type"] === "object" && !("$ref" in record)) {
    const additional = record["additionalProperties"];
    if (additional === undefined || additional === true) return false;
  }
  return Object.values(record).every(isFullyClosed);
}

export { isFullyClosed, reachesEnvelope };
