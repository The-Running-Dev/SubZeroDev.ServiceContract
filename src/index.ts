/**
 * The published package's runtime surface. Deliberately narrow: types (erased at compile time —
 * zero runtime footprint) plus `loadPublishedContract`, which reads the artifact this repository's
 * own build already generated and bundled (`scripts/generate-contract.ts`) using nothing but
 * `node:fs` and `JSON.parse`.
 *
 * `generate` itself is **not** re-exported here. It is real, tested code (`generate.js`), but its
 * module graph resolves the engine package through `ts-morph` and `ts-json-schema-generator` —
 * dev-only tooling this repository's own build uses, never something a consumer reading the
 * artifact should have to install. A static `export { generate }` here would pull that whole graph
 * into every consumer's `import`, which is exactly what "the published artifact depends on nothing"
 * (`90-decisions.md`, 2026-08-09, Design Q3) rules out.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type { ContractKind, ContractPackage, ContractPackageBase } from "./types.js";

export * from "./types.js";

/** An artifact's `contractKind` did not match what the loader reading it expected — e.g.
 *  `loadPublishedContract` finding `content-contract.json`'s shape at `contract.json`'s path.
 *  A `JSON.parse`'d artifact is otherwise unverified; this is the one check a loader can make
 *  without a full schema validator. */
export class ContractKindMismatchError extends Error {
  constructor(
    readonly fileName: string,
    readonly expected: ContractKind,
    readonly actual: string,
  ) {
    super(`${fileName}: expected contractKind "${expected}", got "${actual}"`);
    this.name = "ContractKindMismatchError";
  }
}

function readArtifact<T extends ContractPackageBase>(fileName: string, kind: ContractKind): T {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(here, fileName), "utf8");
  const parsed = JSON.parse(raw) as T;
  if (parsed.contractKind !== kind) {
    throw new ContractKindMismatchError(fileName, kind, parsed.contractKind);
  }
  return parsed;
}

/** Reads the `ContractPackage` this package's own build produced and bundled alongside its
 *  compiled code (`dist/contract.json`) — the one thing a consumer installing this package needs. */
export function loadPublishedContract(): ContractPackage {
  return readArtifact<ContractPackage>("contract.json", "rpc-surface");
}
