/**
 * S2.9 — publish under a semantic version; republish of the same version is refused; a consumer
 * pinning that version resolves it and reads its `operations` without any other input. Run against
 * a local, ephemeral registry rather than live npm — real `@subzerodev` publishing needs
 * credentials this session doesn't have (`90-decisions.md`, 2026-08-09, Unresolved 4).
 */
import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { startMockRegistry } from "./support/mock-registry.js";

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function run(args: string[], cwd: string): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn("npm", args, { shell: true, stdio: ["ignore", "pipe", "pipe"], cwd });
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (out += d.toString()));
    child.on("close", (code) => resolve({ code, out }));
  });
}

describe("S2.9 — publish path against a local registry", () => {
  it(
    "publishes once, refuses to republish the same version, and a consumer resolves and reads operations",
    // 60s was enough when `prepack` ran one generator (SessionStore). It now runs two --
    // this test triggers `npm publish`'s prepack twice (publish, then the refused republish)
    // plus an install, and the content-document generator alone (four separate
    // ts-json-schema-generator invocations: the manifest, and three per-kind campaign
    // projections merged in `content-merge.ts`) adds real time, not overhead to shave.
    { timeout: 180_000 },
    async () => {
      expect(existsSync(join(REPO_ROOT, "dist", "contract.json"))).toBe(true);

      const registry = await startMockRegistry();
      const hostport = registry.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const npmrcDir = mkdtempSync(join(tmpdir(), "npmrc-"));
      const npmrcPath = join(npmrcDir, ".npmrc");
      writeFileSync(npmrcPath, `//${hostport}/:_authToken=test-token\n`);

      try {
        const publishArgs = ["publish", "--registry", registry.url, "--access", "public", "--userconfig", npmrcPath];
        const first = await run(publishArgs, REPO_ROOT);
        expect(first.code).toBe(0);

        const second = await run(publishArgs, REPO_ROOT);
        expect(second.code).not.toBe(0);
        expect(second.out).toMatch(/cannot publish over|previously published/i);

        const installDir = mkdtempSync(join(tmpdir(), "consumer-"));
        writeFileSync(
          join(installDir, "package.json"),
          JSON.stringify({ name: "consumer", version: "1.0.0", type: "module" }),
        );
        const install = await run(
          ["install", "@subzerodev/service-contract", "--registry", registry.url, "--userconfig", npmrcPath],
          installDir,
        );
        expect(install.code).toBe(0);

        const modPath = join(installDir, "node_modules", "@subzerodev", "service-contract", "dist", "index.js");
        const mod = (await import(pathToFileURL(modPath).href)) as {
          loadPublishedContract: () => { operations: unknown[]; engineVersion: string };
          loadPublishedContentContract: () => { documents: unknown[]; formatVersion: number };
        };
        const contract = mod.loadPublishedContract();
        expect(contract.operations.length).toBe(10);
        expect(contract.engineVersion).toBe("0.6.1");

        // Both artifacts ship in the same package, from the same publish -- a consumer that
        // only ever asked for the RPC contract should not silently also get a stale or
        // missing content contract because prepack only wrote one of the two.
        const contentContract = mod.loadPublishedContentContract();
        expect(contentContract.documents.length).toBe(2);
        expect(contentContract.formatVersion).toBe(2);
      } finally {
        await registry.close();
      }
    },
  );
});
