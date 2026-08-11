/**
 * Merges independently-projected, per-kind campaign schemas into one `anyOf` document.
 *
 * `PortableCampaign.campaign` is a `kindId`-discriminated union across three kinds
 * (story-graph, world-graph, simulation), each with its own content vocabulary. Projecting
 * the union as a single `ts-json-schema-generator` root fails: that library keys its
 * `definitions` dictionary by bare type name, and all three kinds happen to declare their own,
 * unrelated `ComparisonOperator` type (`core/condition/types.ts`,
 * `kinds/world-graph/content.ts`, `kinds/simulation/conditions.ts` — verified by generating
 * each kind alone, which succeeds, versus the union, which throws `MultipleDefinitionsError`
 * naming that type first).
 *
 * The fix stays entirely on this side of the boundary rather than reaching back into the
 * engine's type names (which would be true whack-a-mole — nothing here rules out a fourth
 * collision on a fifth kind): project each kind's full campaign document *alone* (proven to
 * work), close each independently, then merge the three closed schemas into one `anyOf`
 * document by namespacing each kind's `definitions` keys so they cannot collide with each
 * other. This keeps the property the content contract's crux gate depends on — one schema,
 * one `validate()` call, every arm fully closed — without an engine change.
 */

export type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const SHARED_DEFINITION_NAMES = new Set(["JsonValue"]);

function namespacedName(prefix: string, name: string): string {
  return SHARED_DEFINITION_NAMES.has(name) ? name : `${prefix}__${name}`;
}

/**
 * `$ref` fragments are percent-encoded (`ts-json-schema-generator` encodes reserved
 * characters like `<`, `>`, `,`, `"` with `encodeURIComponent`, e.g. a generic instantiation
 * name); `definitions` keys are the plain, decoded name. Both directions are needed to
 * rewrite a ref consistently with a renamed key.
 */
function rewriteRefs(node: unknown, rename: (name: string) => string): unknown {
  if (Array.isArray(node)) return node.map((item) => rewriteRefs(item, rename));
  if (!isRecord(node)) return node;
  const result: JsonRecord = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && typeof value === "string" && value.startsWith("#/definitions/")) {
      const decoded = decodeURIComponent(value.slice("#/definitions/".length));
      result[key] = `#/definitions/${encodeURIComponent(rename(decoded))}`;
    } else {
      result[key] = rewriteRefs(value, rename);
    }
  }
  return result;
}

export interface ClosedKindSchema {
  readonly kindId: string;
  /** A closed schema as `closeSchema` returns it: `{ $ref, definitions }` (or, for a schema
   *  with no named root, the object shape directly) — this module does not care which, since
   *  it rewrites `$ref`s and definitions uniformly and passes everything else through. */
  readonly closed: JsonRecord;
}

export interface MergedKindSchema {
  readonly anyOf: readonly JsonRecord[];
  readonly definitions: Readonly<Record<string, JsonRecord>>;
}

/** Namespaces and merges N independently-closed per-kind schemas into one `anyOf` document.
 *  A definition named in `SHARED_DEFINITION_NAMES` (only `JsonValue` today) is deduplicated
 *  rather than namespaced — it is a fixed, content-free constant (`schema-close.ts`'s
 *  `JSON_VALUE_SCHEMA`) wherever it appears, so every kind's copy is byte-identical and a
 *  shared definition is strictly more correct than three redundant ones. */
export function mergeKindSchemas(perKind: readonly ClosedKindSchema[]): MergedKindSchema {
  const definitions: Record<string, JsonRecord> = {};
  const anyOf: JsonRecord[] = [];

  for (const { kindId, closed } of perKind) {
    const prefix = kindId.replace(/[^a-zA-Z0-9]/g, "_");
    const rename = (name: string): string => namespacedName(prefix, name);

    const { definitions: rawDefinitions, ...root } = closed;
    for (const [name, def] of Object.entries((rawDefinitions ?? {}) as JsonRecord)) {
      const renamed = rename(name);
      if (!(renamed in definitions)) {
        definitions[renamed] = rewriteRefs(def, rename) as JsonRecord;
      }
    }
    anyOf.push(rewriteRefs(root, rename) as JsonRecord);
  }

  return { anyOf, definitions };
}
