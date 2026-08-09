/**
 * The one place `generate`'s result is written to disk. `generate` itself never touches the
 * filesystem (`20-contract.md`'s only signature is in-memory); this is the thin wrapper the
 * contract repository's own build calls, and the one S2.2 checks for "no artifact on either
 * failure — the output directory is byte-identical before and after."
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "./generate.js";
import type { ContractPackage, GenerationError, GenerationInput, Outcome } from "./types.js";

export async function writeContractArtifact(
  outputDir: string,
  input: GenerationInput,
): Promise<Outcome<ContractPackage, GenerationError>> {
  const result = await generate(input);
  if (!result.ok) {
    return result;
  }
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  writeFileSync(join(outputDir, "contract.json"), JSON.stringify(result.value, null, 2), "utf8");
  return result;
}

/** Byte-for-byte directory contents, for S2.2's "output directory is unchanged" assertion. */
export function snapshotDir(dir: string): readonly string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort();
}
