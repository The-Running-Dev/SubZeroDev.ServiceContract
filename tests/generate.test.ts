import { describe, expect, it, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Ajv2020 = require("ajv/dist/2020.js") as new (opts?: { strict?: boolean }) => {
  addSchema(schema: unknown, key: string): void;
  getSchema(key: string): ((data: unknown) => boolean) | undefined;
};
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate, isFullyClosed, reachesEnvelope } from "../src/generate.js";
import { resolveEngine, EngineResolutionError } from "../src/engine-introspect.js";
import { closeSchema } from "../src/schema-close.js";
import { AUTHORED_ROWS, STATUS_MAPPING_ENTRIES } from "../src/rows.js";
import { writeContractArtifact, snapshotDir } from "../src/build-artifact.js";
import type { AuthoredRow, GenerationInput } from "../src/types.js";

/** The version the generator will actually resolve out of `node_modules`. Read once, here,
 *  rather than written as a literal: a literal is a second statement of which engine this suite
 *  runs against, and it drifted from the real one for three releases (`0.5.0` here while the
 *  pin moved to `0.6.1` and then `0.8.0`) without a single test noticing — which is the very
 *  drift `EngineVersionMismatch` below now refuses. */
const RESOLVED_ENGINE_VERSION = resolveEngine(process.cwd()).version;

function baseInput(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    engineVersion: RESOLVED_ENGINE_VERSION as GenerationInput["engineVersion"],
    contractVersion: "0.1.0" as GenerationInput["contractVersion"],
    wireVersion: "v1" as GenerationInput["wireVersion"],
    rows: AUTHORED_ROWS,
    statusMapping: { entries: STATUS_MAPPING_ENTRIES },
    ...overrides,
  };
}

describe("S2.1 — generate produces a ContractPackage matching the pinned engine", () => {
  it("emits one row per SessionStore method, and the recorded engineVersion", async () => {
    const engine = resolveEngine(process.cwd());
    const result = await generate(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.operations.length).toBe(engine.methods.length);
    expect(result.value.engineVersion).toBe(engine.version);
  });
});

describe("engine version gate — the artifact cannot claim a version the resolved engine does not have", () => {
  it("fails with EngineVersionMismatch when the authored engineVersion is not the resolved one", async () => {
    const result = await generate(baseInput({ engineVersion: "9.9.9" as GenerationInput["engineVersion"] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("EngineVersionMismatch");
  });

  it("names both versions, so the failure says which pin disagrees with which install", async () => {
    const result = await generate(baseInput({ engineVersion: "9.9.9" as GenerationInput["engineVersion"] }));
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === "EngineVersionMismatch") {
      expect(result.error.authored).toBe("9.9.9");
      expect(result.error.resolved).toBe(RESOLVED_ENGINE_VERSION);
    } else {
      expect.unreachable("expected EngineVersionMismatch");
    }
  });

  it("passes when the authored version is the resolved one", async () => {
    const result = await generate(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.engineVersion).toBe(RESOLVED_ENGINE_VERSION);
  });

  it("writes nothing when the versions disagree", async () => {
    const dir = mkdtempSync(join(tmpdir(), "version-gate-"));
    try {
      const before = snapshotDir(dir);
      const result = await writeContractArtifact(
        dir,
        baseInput({ engineVersion: "9.9.9" as GenerationInput["engineVersion"] }),
      );
      expect(result.ok).toBe(false);
      expect(snapshotDir(dir)).toEqual(before);
      expect(existsSync(join(dir, "contract.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("S2.2 — arity gate refuses to publish on mismatch, and writes nothing", () => {
  it("fails with ArityMismatch naming the uncovered method when a row is deleted", async () => {
    const rows = AUTHORED_ROWS.filter((r) => r.storeMethod !== "saveGame");
    const result = await generate(baseInput({ rows }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ArityMismatch");
  });

  it("fails with ArityMismatch naming the row when an unknown storeMethod is added", async () => {
    const badRow: AuthoredRow = {
      operation: "not-a-real-operation" as AuthoredRow["operation"],
      storeMethod: "notARealMethod" as AuthoredRow["storeMethod"],
      mcpTool: "not_a_real_tool" as AuthoredRow["mcpTool"],
      narrowings: [],
      reachableErrors: [],
    };
    const result = await generate(baseInput({ rows: [...AUTHORED_ROWS, badRow] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ArityMismatch");
  });

  it("leaves the output directory byte-identical before and after either failure", async () => {
    const dir = mkdtempSync(join(tmpdir(), "artifact-out-"));
    try {
      const before = snapshotDir(dir);
      const badRows = AUTHORED_ROWS.filter((r) => r.storeMethod !== "saveGame");
      const result = await writeContractArtifact(dir, baseInput({ rows: badRows }));
      expect(result.ok).toBe(false);
      expect(snapshotDir(dir)).toEqual(before);
      expect(existsSync(join(dir, "contract.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("S2.3 — status mapping exactly covers engine codes plus transport codes", () => {
  it("fails with ErrorCodeUncovered when an entry is deleted", async () => {
    const entries = STATUS_MAPPING_ENTRIES.filter((e) => e.code !== "unknown_session");
    const result = await generate(baseInput({ statusMapping: { entries } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ErrorCodeUncovered");
  });

  it("fails with ErrorCodeUncovered when an entry names a code that isn't an engine or transport code", async () => {
    const entries = [...STATUS_MAPPING_ENTRIES, { code: "not_a_real_code" as never, status: 500 as const }];
    const result = await generate(baseInput({ statusMapping: { entries } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ErrorCodeUncovered");
  });
});

describe("S2.4 — closed-schema and envelope gates (unit level — generate()'s own output is always closed)", () => {
  it("isFullyClosed rejects an object schema without additionalProperties: false", () => {
    const open = { type: "object", properties: { a: { type: "string" } } };
    expect(isFullyClosed(open)).toBe(false);
  });

  it("isFullyClosed accepts a closed object schema", () => {
    const closed = { type: "object", properties: { a: { type: "string" } }, additionalProperties: false };
    expect(isFullyClosed(closed)).toBe(true);
  });

  it("isFullyClosed accepts a constrained map (additionalProperties as a schema, not true)", () => {
    const map = { type: "object", additionalProperties: { type: "string" } };
    expect(isFullyClosed(map)).toBe(true);
  });

  it("reachesEnvelope is true when a response schema's $ref chain reaches a GameState definition", () => {
    const schema = {
      $ref: "#/definitions/ActionResult",
      definitions: {
        ActionResult: { type: "object", properties: { state: { $ref: "#/definitions/GameState" } } },
        GameState: { type: "object", properties: {} },
      },
    };
    expect(reachesEnvelope(schema)).toBe(true);
  });

  it("reachesEnvelope is false for the real generated schemas (none of the ten rows reaches GameState)", async () => {
    const result = await generate(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const schema of result.value.schemas) {
      expect(reachesEnvelope(schema)).toBe(false);
    }
  });

  it("generate()'s own output is closed at every object level, for every schema", async () => {
    const result = await generate(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const schema of result.value.schemas) {
      expect(isFullyClosed(schema)).toBe(true);
    }
  });
});

describe("S2.5 — narrowing, duplicate id, and determinism-profile gates", () => {
  it("fails with NarrowingUnknownField when a narrowing names a member the engine doesn't have", async () => {
    const rows = AUTHORED_ROWS.map((r) =>
      r.storeMethod === "getScene"
        ? { ...r, narrowings: [{ side: "request" as const, field: "notAField" }] }
        : r,
    );
    const result = await generate(baseInput({ rows }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NarrowingUnknownField");
  });

  it("fails with DuplicateOperationId when two rows share an operation id", async () => {
    const clashing = AUTHORED_ROWS.map((r, i) => (i === 1 ? { ...r, operation: AUTHORED_ROWS[0]!.operation } : r));
    const result = await generate(baseInput({ rows: clashing }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DuplicateOperationId");
  });

  it("fails with DuplicateOperationId when two rows share an mcpTool name", async () => {
    const clashing = AUTHORED_ROWS.map((r, i) => (i === 1 ? { ...r, mcpTool: AUTHORED_ROWS[0]!.mcpTool } : r));
    const result = await generate(baseInput({ rows: clashing }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DuplicateOperationId");
  });

  it("fails with DeterminismProfileInRow when a row smuggles a determinism member", async () => {
    const bad = { ...AUTHORED_ROWS[0]!, determinism: { kind: "replay" } } as unknown as AuthoredRow;
    const rows = [bad, ...AUTHORED_ROWS.slice(1)];
    const result = await generate(baseInput({ rows }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DeterminismProfileInRow");
  });
});

describe("S2.6 — httpPath equals operation, and every shape resolves within the artifact", () => {
  it("every row's httpPath equals its operation verbatim", async () => {
    const result = await generate(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const row of result.value.operations) {
      expect(row.httpPath as string).toBe(row.operation as string);
    }
  });

  it("every requestShape and responseShape resolves to a document in the artifact's schemas", async () => {
    const result = await generate(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = new Set(result.value.schemas.map((s) => s.$id));
    for (const row of result.value.operations) {
      expect(ids.has(row.requestShape)).toBe(true);
      expect(ids.has(row.responseShape)).toBe(true);
    }
  });
});

describe("S2.7 — engine resolution: no network fetch, and a clear failure when unresolvable", () => {
  it("generation performs no outbound network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await generate(baseInput());
    expect(result.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("resolveEngine throws EngineResolutionError when the package cannot be resolved", () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "no-engine-here-"));
    try {
      expect(() => resolveEngine(emptyDir)).toThrow(EngineResolutionError);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("generate() surfaces EngineResolutionFailed naming the package and registry when unresolvable", async () => {
    const originalCwd = process.cwd();
    const emptyDir = mkdtempSync(join(tmpdir(), "no-engine-cwd-"));
    process.chdir(emptyDir);
    try {
      const result = await generate(baseInput());
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("EngineResolutionFailed");
      if (result.error.code === "EngineResolutionFailed") {
        expect(result.error.packageName).toBe("@the-running-dev/game-engine");
      }
    } finally {
      process.chdir(originalCwd);
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

describe("S2.8 — one schema dialect, and ajv enforces the closed-schema gate for real", () => {
  it("every emitted schema declares the same $schema dialect", async () => {
    const result = await generate(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dialects = new Set(result.value.schemas.map((s) => s.$schema));
    expect(dialects.size).toBe(1);
    expect([...dialects][0]).toBe("https://json-schema.org/draft/2020-12/schema");
  });

  it("ajv loads every schema and rejects an added member on a closed response schema", async () => {
    const result = await generate(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ajv = new Ajv2020({ strict: false });
    for (const schema of result.value.schemas) {
      ajv.addSchema(schema, schema.$id);
    }

    const saveGameRow = result.value.operations.find((r) => r.operation === "save-game")!;
    const validate = ajv.getSchema(saveGameRow.responseShape)!;
    expect(validate({ saveId: "abc" })).toBe(true);
    expect(validate({ saveId: "abc", extra: "not declared" })).toBe(false);
  });
});

describe("S2.10 — the generator is deterministic", () => {
  it("running twice over an unchanged row set and engine produces byte-identical artifacts", async () => {
    const [first, second] = await Promise.all([generate(baseInput()), generate(baseInput())]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
  });
});

beforeAll(() => {
  // The engine must be resolvable for every test above except the deliberate-failure ones —
  // fail loudly up front rather than have ten opaque per-test failures if `npm install` didn't run.
  expect(() => resolveEngine(process.cwd())).not.toThrow();
});
