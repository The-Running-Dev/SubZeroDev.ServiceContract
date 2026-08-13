/**
 * Runs `generateContent` over the authored document row set and writes the result to
 * `dist/content-contract.json`, bundled into the published package alongside `contract.json`.
 * Part of `npm run build`, after `generate-contract.ts` — never run by a consumer installing
 * the package.
 */
import { fileURLToPath } from "node:url";
import { writeContentContractArtifact } from "../src/build-artifact.js";
import { AUTHORED_DOCUMENT_ROWS } from "../src/documents.js";
import type { ContentGenerationInput } from "../src/types.js";

const CONTRACT_VERSION = "0.1.0";
// Must end in "v${formatVersion}" -- ContentRootVersionMismatch checks this against the
// engine's own PortableManifest.formatVersion (currently 2, per the graduation in Phase 1).
const CONTENT_ROOT = "https://the-running-dev.github.io/SubZeroDev.Adventures.Content/v2";

const input: ContentGenerationInput = {
  engineVersion: "0.8.0" as ContentGenerationInput["engineVersion"],
  contractVersion: CONTRACT_VERSION as ContentGenerationInput["contractVersion"],
  contentRoot: CONTENT_ROOT,
  rows: AUTHORED_DOCUMENT_ROWS,
};

const distDir = fileURLToPath(new URL("../dist", import.meta.url));
const result = await writeContentContractArtifact(distDir, input);
if (!result.ok) {
  console.error("content contract generation failed:", result.error);
  process.exit(1);
}
console.log(
  `wrote dist/content-contract.json — formatVersion ${result.value.formatVersion}, ${result.value.documents.length} documents, ${result.value.schemas.length} schemas`,
);
