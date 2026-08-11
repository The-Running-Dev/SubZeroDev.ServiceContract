/**
 * Pure predicates over closed content-document schemas — this boundary's analogue of
 * `generate.ts`'s `isFullyClosed`/`reachesEnvelope`. Exported so each is unit-testable
 * against a doctored schema without needing a doctored engine, the same reasoning
 * `generate.ts` states for its own exports.
 */
import type { MergedKindSchema } from "./content-merge.js";

export type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Follows a `$ref` chain into `definitions`, stopping at the first non-`$ref` node (or at a
 *  dangling/cyclic ref, which callers treat as "nothing found" rather than as a crash — a
 *  malformed schema should fail the gate whose shape it broke, not this resolver). */
function resolveNode(node: JsonRecord, definitions: Readonly<Record<string, JsonRecord>>): JsonRecord {
  let current = node;
  const seen = new Set<string>();
  while (typeof current["$ref"] === "string") {
    const ref = current["$ref"] as string;
    if (!ref.startsWith("#/definitions/")) break;
    const name = decodeURIComponent(ref.slice("#/definitions/".length));
    if (seen.has(name)) break;
    seen.add(name);
    const next = definitions[name];
    if (!next) break;
    current = next;
  }
  return current;
}

function propertiesOf(node: JsonRecord): JsonRecord {
  return isRecord(node["properties"]) ? (node["properties"] as JsonRecord) : {};
}

function constStringOf(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined;
  return typeof node["const"] === "string" ? (node["const"] as string) : undefined;
}

/** An `anyOf` arm is the *document* root (`{formatVersion, catalog, campaign, strings}`);
 *  `kindId` and `content` live one level deeper, on the `campaign` member's own resolved
 *  definition (`PortableCampaignEnvelope`, `format.ts`) — this resolves both hops so callers
 *  never have to know the shape has two names for what reads like one thing. */
function campaignEnvelopeOf(arm: JsonRecord, definitions: Readonly<Record<string, JsonRecord>>): JsonRecord {
  const documentRoot = resolveNode(arm, definitions);
  const campaignNode = propertiesOf(documentRoot)["campaign"];
  return isRecord(campaignNode) ? resolveNode(campaignNode, definitions) : {};
}

/**
 * Gate: no arm of the merged campaign document may resolve `content` to the shared
 * `JsonValue` fallback (`content-merge.ts`'s `SHARED_DEFINITION_NAMES`, `schema-close.ts`'s
 * `isUnconstrained` — the same fold that made an unconstrained position schema-legal in the
 * RPC contract). A leaf inside a kind's own content type folding to `JsonValue` stays legal;
 * `content` itself resolving there does not — that would mean the campaign that kind ships is
 * validated as "any JSON," not as that kind's actual shape.
 *
 * Returns the `kindId` of the first opaque arm found, or `undefined` if every arm is closed.
 */
export function opaqueContentPayload(merged: MergedKindSchema): string | undefined {
  for (const arm of merged.anyOf) {
    const properties = propertiesOf(campaignEnvelopeOf(arm, merged.definitions));
    const kindId = constStringOf(properties["kindId"]) ?? "unknown";
    const content = properties["content"];
    if (isRecord(content) && content["$ref"] === "#/definitions/JsonValue") {
      return kindId;
    }
  }
  return undefined;
}

/**
 * Gate: every kind the engine declares must appear as an `anyOf` arm's `kindId` const.
 * `knownKindIds` is authored (`documents.ts`'s `KNOWN_KIND_IDS`), not introspected from the
 * same projection this checks — a list derived from the thing it verifies could never catch
 * that thing falling behind.
 *
 * Returns the first missing `kindId`, or `undefined` if every one is covered.
 */
export function missingKindCoverage(merged: MergedKindSchema, knownKindIds: readonly string[]): string | undefined {
  const covered = new Set<string>();
  for (const arm of merged.anyOf) {
    const kindId = constStringOf(propertiesOf(campaignEnvelopeOf(arm, merged.definitions))["kindId"]);
    if (kindId !== undefined) covered.add(kindId);
  }
  return knownKindIds.find((kindId) => !covered.has(kindId));
}

/**
 * Gate: a document's `formatVersion` must project as a JSON Schema `const`, not a bare
 * `type: "number"` — widening it would silently disable both `FormatVersionMismatch` (below)
 * and the `$id` version-pathing that is projected from this same value
 * (`generate-content.ts`). `root` is the document's own root node (already resolved past any
 * top-level `$ref`, since the caller has the document's `definitions` at hand either way).
 *
 * Returns the const value, or `undefined` if the document does not declare a numeric const
 * `formatVersion`.
 */
export function formatVersionConst(root: JsonRecord): number | undefined {
  const node = propertiesOf(root)["formatVersion"];
  if (!isRecord(node)) return undefined;
  return typeof node["const"] === "number" ? (node["const"] as number) : undefined;
}

/**
 * Gate: a manifest entry must be an identified object (`id`, `version`, `digest`), not a bare
 * filename string — the defect the pre-graduation manifest actually had (`file:0.5.0`'s
 * `campaigns: readonly string[]`), encoded here so it cannot silently return. `campaignsItems`
 * is the manifest's `properties.campaigns.items` node, already resolved past any `$ref`.
 *
 * Returns the first required field missing from the item shape, or `undefined` if all three
 * are present.
 */
export function firstMissingManifestEntryField(campaignsItems: JsonRecord): string | undefined {
  const itemProperties = propertiesOf(campaignsItems);
  return ["id", "version", "digest"].find((field) => !(field in itemProperties));
}

export { resolveNode, propertiesOf };
