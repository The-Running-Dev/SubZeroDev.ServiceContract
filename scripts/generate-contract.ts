/**
 * Runs `generate` over the authored row set and writes the result to `dist/contract.json`,
 * bundled into the published package alongside the compiled code (`package.json`'s `files`).
 * Part of `npm run build`, after `tsc` — never run by a consumer installing the package.
 */
import { fileURLToPath } from "node:url";
import { writeContractArtifact } from "../src/build-artifact.js";
import { AUTHORED_ROWS, STATUS_MAPPING_ENTRIES } from "../src/rows.js";
import type { GenerationInput } from "../src/types.js";

const CONTRACT_VERSION = "0.3.0";
const ENGINE_VERSION = "0.6.1";
const WIRE_VERSION = "v1";

const input: GenerationInput = {
  engineVersion: ENGINE_VERSION as GenerationInput["engineVersion"],
  contractVersion: CONTRACT_VERSION as GenerationInput["contractVersion"],
  wireVersion: WIRE_VERSION as GenerationInput["wireVersion"],
  rows: AUTHORED_ROWS,
  statusMapping: { entries: STATUS_MAPPING_ENTRIES },
};

const distDir = fileURLToPath(new URL("../dist", import.meta.url));
const result = await writeContractArtifact(distDir, input);
if (!result.ok) {
  console.error("contract generation failed:", result.error);
  process.exit(1);
}
console.log(`wrote dist/contract.json — ${result.value.operations.length} operations, ${result.value.schemas.length} schemas`);
