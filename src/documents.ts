/**
 * The authored document row set for the content contract — this boundary's analogue of
 * `rows.ts`. Two documents: the manifest a fetcher reads first, and the per-campaign document
 * it lists. Both project from `@the-running-dev/game-engine`'s portable campaign format
 * (`src/portable/format.ts` upstream), graduated out of spike status specifically so this
 * contract would have a real source of truth to project from (rule 1).
 *
 * `campaign`'s row names the whole `PortableCampaign` type as its `engineType`, but its
 * actual schema is not projected the way `manifest`'s is — see `content-merge.ts` for why
 * (three kinds sharing colliding vocabulary names) and `generate-content.ts` for the
 * per-kind-narrow-then-merge path that document specifically takes.
 */
import type { AuthoredDocumentRow, DocumentId, EngineTypeName } from "./types.js";

function id(value: string): DocumentId {
  return value as DocumentId;
}
function engineType(value: string): EngineTypeName {
  return value as EngineTypeName;
}

export const AUTHORED_DOCUMENT_ROWS: readonly AuthoredDocumentRow[] = [
  {
    documentId: id("manifest"),
    engineType: engineType("PortableManifest"),
    narrowings: [],
    cardinality: "exactly-one",
    publishedPath: "manifest.json",
  },
  {
    documentId: id("campaign"),
    engineType: engineType("PortableCampaign"),
    narrowings: [],
    cardinality: "one-per-campaign",
  },
];

/** The engine's own kind vocabulary (`core/kernel/types.ts`, `KindId`), authored here the same
 *  way `generate.ts` authors `KNOWN_ENGINE_ERROR_CODES` — a fixed list checked against, not
 *  introspected, because the check this drives (`KindCoverageIncomplete`) is about the
 *  document schema's `anyOf` arms actually covering every kind, and a list introspected from
 *  the same place the schema is projected from could never catch the schema falling behind
 *  it (`content-merge.ts`'s per-kind list and this one would just as easily drift together as
 *  separately, unless something outside both states what "every kind" means). */
export const KNOWN_KIND_IDS = ["story-graph", "world-graph", "simulation"] as const;
