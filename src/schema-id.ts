/**
 * `$id` construction, shared across every contract this repository generates.
 *
 * Extracted from `generate.ts`'s original `schemaRef` (SessionStore-specific: it took a
 * fixed `side: "request" | "response"`) so a second, structurally different contract can
 * build its own `$id`s under the same host without a `side` that makes no sense for it.
 */
import type { SchemaRef } from "./types.js";

export const SCHEMA_HOST = "https://contracts.subzerodev.dev";

/**
 * `{host}/{contract}/{version}/{...segments}.json`. `contract` is that contract's own path
 * segment (`service-contract`, `content-contract`, …), so two contracts in this repository
 * cannot collide; `version` is that contract's own wire or format version — rule 4's "a 2.0
 * schema lives at a different path from 1.0," applied per contract rather than per
 * repository.
 */
export function schemaId(contract: string, version: string, ...segments: readonly string[]): SchemaRef {
  return `${SCHEMA_HOST}/${contract}/${version}/${[...segments].join("/")}.json` as SchemaRef;
}
