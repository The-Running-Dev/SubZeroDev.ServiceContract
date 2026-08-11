/**
 * The one place `generate`'s result is written to disk. `generate` itself never touches the
 * filesystem (`20-contract.md`'s only signature is in-memory); this is the thin wrapper the
 * contract repository's own build calls, and the one S2.2 checks for "no artifact on either
 * failure — the output directory is byte-identical before and after."
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "./generate.js";
import { generateContent } from "./generate-content.js";
import type {
  ContentContractPackage,
  ContentGenerationError,
  ContentGenerationInput,
  ContractPackage,
  GenerationError,
  GenerationInput,
  Outcome,
} from "./types.js";

/**
 * Runs `produce`, and on success writes its value to `<outputDir>/<fileName>` — creating
 * `outputDir` if needed. Writes nothing on failure, which is what makes S2.2's "the output
 * directory is byte-identical before and after either failure" true for any generator built
 * on top of this, not only `generate`.
 */
async function writeArtifact<T, E>(
  outputDir: string,
  fileName: string,
  produce: () => Promise<Outcome<T, E>>,
): Promise<Outcome<T, E>> {
  const result = await produce();
  if (!result.ok) {
    return result;
  }
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  writeFileSync(join(outputDir, fileName), JSON.stringify(result.value, null, 2), "utf8");
  return result;
}

export function writeContractArtifact(
  outputDir: string,
  input: GenerationInput,
): Promise<Outcome<ContractPackage, GenerationError>> {
  return writeArtifact(outputDir, "contract.json", () => generate(input));
}

export function writeContentContractArtifact(
  outputDir: string,
  input: ContentGenerationInput,
): Promise<Outcome<ContentContractPackage, ContentGenerationError>> {
  return writeArtifact(outputDir, "content-contract.json", () => generateContent(input));
}

/** Byte-for-byte directory contents, for S2.2's "output directory is unchanged" assertion. */
export function snapshotDir(dir: string): readonly string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort();
}
