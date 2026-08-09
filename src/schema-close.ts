/**
 * Closes a projected schema at every object level and applies a row's narrowings. This is the
 * static half of the projection-boundary gate (invariant 3, 3a) plus invariant 7's mechanism.
 */
import type { RawSchema } from "./schema-gen.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The engine has exactly one genuinely unconstrained position: `PlayerView.kindView`, typed
 *  `unknown` because it is kind-polymorphic. Projected as `{}` (draft-07 emits no `type` at all
 *  for `unknown`), an unconstrained schema is the honest answer to a position the engine itself
 *  declares open-shaped — but "closed at every object level" still has to mean something there,
 *  so it is closed to *any JSON value* (the contract's own `JsonValue` shape) rather than left
 *  fully unconstrained (which would also admit non-JSON, functions, etc.). */
const JSON_VALUE_DEFINITION_NAME = "JsonValue";
const JSON_VALUE_SCHEMA: JsonRecord = {
  anyOf: [
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
    { type: "null" },
    { type: "array", items: { $ref: `#/definitions/${JSON_VALUE_DEFINITION_NAME}` } },
    {
      type: "object",
      additionalProperties: { $ref: `#/definitions/${JSON_VALUE_DEFINITION_NAME}` },
    },
  ],
};

function isUnconstrained(schema: JsonRecord): boolean {
  const keys = Object.keys(schema);
  return keys.length === 0 || (keys.length === 1 && keys[0] === "$comment");
}

function closeObjectLevels(node: unknown, definitions: JsonRecord, usedJsonValue: { value: boolean }): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => closeObjectLevels(item, definitions, usedJsonValue));
  }
  if (!isRecord(node)) {
    return node;
  }
  if (isUnconstrained(node)) {
    usedJsonValue.value = true;
    return { $ref: `#/definitions/${JSON_VALUE_DEFINITION_NAME}` };
  }

  const result: JsonRecord = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = closeObjectLevels(value, definitions, usedJsonValue);
  }
  if (result["type"] === "object" && !("$ref" in result)) {
    if (!("additionalProperties" in result) || result["additionalProperties"] === true) {
      result["additionalProperties"] = false;
    }
  }
  return result;
}

/** Deletes a top-level member from `properties`/`required` — narrowing operates on the row's
 *  request or response object directly; the schema is generated topRef:false, so the type's own
 *  properties (not a `$ref`'d definition) are what a narrowing removes. */
function applyNarrowing(schema: JsonRecord, field: string): void {
  if (isRecord(schema["properties"])) {
    delete (schema["properties"] as JsonRecord)[field];
  }
  if (Array.isArray(schema["required"])) {
    schema["required"] = (schema["required"] as unknown[]).filter((entry) => entry !== field);
  }
}

export interface CloseSchemaOptions {
  readonly narrowFields?: readonly string[];
}

/** Closes every object level, folds the one unconstrained position into the shared `JsonValue`
 *  definition, and applies the row's narrowings — the pure post-processing step between
 *  `projectSchemas`'s raw draft-07 output and the artifact's draft-2020-12 documents. */
export function closeSchema(raw: RawSchema, options: CloseSchemaOptions = {}): JsonRecord {
  const definitions = isRecord(raw["definitions"]) ? { ...(raw["definitions"] as JsonRecord) } : {};
  const usedJsonValue = { value: false };

  const closedDefinitions: JsonRecord = {};
  for (const [name, def] of Object.entries(definitions)) {
    closedDefinitions[name] = closeObjectLevels(def, definitions, usedJsonValue);
  }

  const { definitions: _omit, $schema: _omitSchema, ...rest } = raw as JsonRecord;
  const closedRoot = closeObjectLevels(rest, definitions, usedJsonValue) as JsonRecord;

  // A plain type alias to another named type (`SaveGameResponse = SaveHandle`) closes to a root
  // that is just `{ $ref: "#/definitions/SaveHandle" }` — the object shape a narrowing must edit
  // lives one hop into `definitions`, not at the root itself.
  const narrowingTarget =
    typeof closedRoot["$ref"] === "string"
      ? (closedDefinitions[(closedRoot["$ref"] as string).replace("#/definitions/", "")] as
          | JsonRecord
          | undefined)
      : closedRoot;
  for (const field of options.narrowFields ?? []) {
    if (narrowingTarget) applyNarrowing(narrowingTarget, field);
  }

  if (usedJsonValue.value) {
    closedDefinitions[JSON_VALUE_DEFINITION_NAME] = JSON_VALUE_SCHEMA;
  }

  return {
    ...closedRoot,
    definitions: closedDefinitions,
  };
}
