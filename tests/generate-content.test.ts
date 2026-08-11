import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Ajv2020 = require("ajv/dist/2020.js") as new (opts?: { strict?: boolean }) => {
  compile(schema: unknown): (data: unknown) => boolean;
};

import { generateContent } from "../src/generate-content.js";
import { AUTHORED_DOCUMENT_ROWS, KNOWN_KIND_IDS } from "../src/documents.js";
import { writeContentContractArtifact } from "../src/build-artifact.js";
import { mergeKindSchemas } from "../src/content-merge.js";
import { opaqueContentPayload, missingKindCoverage, formatVersionConst, firstMissingManifestEntryField } from "../src/content-gates.js";
import type { AuthoredDocumentRow, ContentGenerationInput } from "../src/types.js";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function baseInput(overrides: Partial<ContentGenerationInput> = {}): ContentGenerationInput {
  return {
    engineVersion: "0.6.0" as ContentGenerationInput["engineVersion"],
    contractVersion: "0.1.0" as ContentGenerationInput["contractVersion"],
    contentRoot: "https://the-running-dev.github.io/SubZeroDev.Adventures.Content/v2",
    rows: AUTHORED_DOCUMENT_ROWS,
    ...overrides,
  };
}

// A minimal closed schema shaped exactly like a real per-kind campaign document: the
// document root's `properties.campaign` is a `$ref` into a definition carrying `kindId` and
// `content` — the same two-hop shape `content-gates.ts`'s `campaignEnvelopeOf` resolves.
function fakeClosedKindSchema(kindId: string, content: Record<string, unknown>): Record<string, unknown> {
  return {
    $ref: "#/definitions/Doc",
    definitions: {
      Doc: {
        type: "object",
        additionalProperties: false,
        properties: {
          formatVersion: { type: "number", const: 2 },
          catalog: { $ref: "#/definitions/Catalog" },
          campaign: { $ref: "#/definitions/Envelope" },
          strings: { type: "object", additionalProperties: { type: "string" } },
        },
        required: ["formatVersion", "catalog", "campaign", "strings"],
      },
      Catalog: { type: "object", additionalProperties: false, properties: {} },
      Envelope: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          kindId: { type: "string", const: kindId },
          version: { type: "string" },
          content,
        },
        required: ["id", "kindId", "version", "content"],
      },
    },
  };
}

// This is the whole point: this suite proves the content contract can be made to fail on
// each named invariant, not only that the real engine happens to satisfy all of them today.

describe("S? — generateContent produces a ContentContractPackage from the real engine", () => {
  it(
    "emits formatVersion 2, two documents, and schemas that validate real published campaign JSON",
    async () => {
      const result = await generateContent(baseInput());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.contractKind).toBe("content-document");
      expect(result.value.formatVersion).toBe(2);
      expect(result.value.documents.map((d) => d.documentId)).toEqual(["manifest", "campaign"]);
      expect(result.value.schemas).toHaveLength(2);

      const manifestSchema = result.value.schemas.find((s) => (s.$id as string).endsWith("/manifest.json"));
      const campaignSchema = result.value.schemas.find((s) => (s.$id as string).endsWith("/campaign.json"));
      expect(manifestSchema).toBeDefined();
      expect(campaignSchema).toBeDefined();

      const ajv = new Ajv2020({ strict: false });
      const validateManifest = ajv.compile(manifestSchema);
      const validateCampaign = ajv.compile(campaignSchema);

      // Real published output — the actual thing this contract governs.
      const manifest = {
        formatVersion: 2,
        campaigns: [{ file: "x.json", id: "x", version: "1.0.0", digest: "sha-256:abc" }],
        resolution: "sha-256:def",
      };
      expect(validateManifest(manifest)).toBe(true);

      const storyGraphCampaign = {
        formatVersion: 2,
        catalog: { title: "T", description: "D", duration: "1h", contentNotice: "N", featured: false },
        campaign: {
          id: "x",
          kindId: "story-graph",
          version: "1.0.0",
          titleKey: "x.title",
          content: { descriptionKey: "x.desc", variables: {}, nodes: {}, startNodeId: "start", achievements: [] },
        },
        strings: { "x.title": "X" },
      };
      expect(validateCampaign(storyGraphCampaign)).toBe(true);

      // A world-graph-shaped content payload under a story-graph kindId must be refused —
      // this is the property OpaqueContentPayload exists to guarantee is even checkable.
      const wrongShape = {
        ...storyGraphCampaign,
        campaign: { ...storyGraphCampaign.campaign, content: { totally: "not a story graph" } },
      };
      expect(validateCampaign(wrongShape)).toBe(false);
    },
    30_000,
  );

  it("writes content-contract.json and nothing on failure (mirrors S2.2 for the RPC contract)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "content-contract-artifact-"));
    try {
      const ok = await writeContentContractArtifact(dir, baseInput());
      expect(ok.ok).toBe(true);
      expect(existsSync(join(dir, "content-contract.json"))).toBe(true);

      const badRows: readonly AuthoredDocumentRow[] = [];
      const failed = await writeContentContractArtifact(dir, baseInput({ rows: badRows }));
      expect(failed.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("S? — control-flow gates (fast: fail before or without the expensive per-kind projection)", () => {
  it("DuplicateDocumentId — fails when two rows share a documentId", async () => {
    const rows = [...AUTHORED_DOCUMENT_ROWS, AUTHORED_DOCUMENT_ROWS[0]!];
    const result = await generateContent(baseInput({ rows }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DuplicateDocumentId");
  });

  it("EngineTypeMissing — fails when the campaign row is absent (contract is incomplete without it)", async () => {
    const manifestOnly = AUTHORED_DOCUMENT_ROWS.filter((r) => (r.documentId as string) === "manifest");
    const result = await generateContent(baseInput({ rows: manifestOnly }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("EngineTypeMissing");
    if (result.error.code === "EngineTypeMissing") expect(result.error.typeName).toBe("PortableCampaign");
  });

  it("EngineTypeMissing — fails when a row names a type the engine does not export", async () => {
    const rows = AUTHORED_DOCUMENT_ROWS.map((r) =>
      (r.documentId as string) === "manifest"
        ? { ...r, engineType: "NotARealPortableType" as AuthoredDocumentRow["engineType"] }
        : r,
    );
    const result = await generateContent(baseInput({ rows }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("EngineTypeMissing");
    if (result.error.code === "EngineTypeMissing") expect(result.error.typeName).toBe("NotARealPortableType");
  });

  it("NarrowingUnknownField — fails when a narrowing names a member the manifest doesn't have", async () => {
    const rows = AUTHORED_DOCUMENT_ROWS.map((r) =>
      (r.documentId as string) === "manifest" ? { ...r, narrowings: ["not-a-real-field"] } : r,
    );
    const result = await generateContent(baseInput({ rows }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NarrowingUnknownField");
  }, 15_000);

  it("ContentRootVersionMismatch — fails when contentRoot's version segment disagrees with formatVersion", async () => {
    const result = await generateContent(baseInput({ contentRoot: "https://example.com/v1" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ContentRootVersionMismatch");
  }, 30_000);
});

describe("S? — schema-shape gates (unit level, against synthetic fixtures — same reasoning generate.ts's own S2.4 gives for testing isFullyClosed/reachesEnvelope directly)", () => {
  it("OpaqueContentPayload — fires when an arm's content resolves to the shared JsonValue fallback", () => {
    const perKind = KNOWN_KIND_IDS.map((kindId) =>
      kindId === "world-graph"
        ? { kindId, closed: fakeClosedKindSchema(kindId, {}) } // {} closes to JsonValue via closeSchema; simulated directly here
        : { kindId, closed: fakeClosedKindSchema(kindId, { $ref: "#/definitions/SomeRealShape" }) },
    );
    // Simulate closeSchema's own fold: an empty `content` node becomes the JsonValue ref.
    const withFold = perKind.map((k) =>
      k.kindId === "world-graph"
        ? {
            kindId: k.kindId,
            closed: {
              ...k.closed,
              definitions: {
                ...(k.closed.definitions as Record<string, unknown>),
                Envelope: {
                  ...(k.closed.definitions as any).Envelope,
                  properties: {
                    ...(k.closed.definitions as any).Envelope.properties,
                    content: { $ref: "#/definitions/JsonValue" },
                  },
                },
              },
            },
          }
        : k,
    );
    const merged = mergeKindSchemas(withFold as never);
    expect(opaqueContentPayload(merged)).toBe("world-graph");
  });

  it("OpaqueContentPayload — passes when every arm's content resolves to a real shape", () => {
    const perKind = KNOWN_KIND_IDS.map((kindId) => ({
      kindId,
      closed: fakeClosedKindSchema(kindId, { $ref: "#/definitions/SomeRealShape" }),
    }));
    const merged = mergeKindSchemas(perKind as never);
    expect(opaqueContentPayload(merged)).toBeUndefined();
  });

  it("KindCoverageIncomplete — fires when an anyOf arm is missing for a known kind", () => {
    const perKind = KNOWN_KIND_IDS.filter((k) => k !== "simulation").map((kindId) => ({
      kindId,
      closed: fakeClosedKindSchema(kindId, { $ref: "#/definitions/SomeRealShape" }),
    }));
    const merged = mergeKindSchemas(perKind as never);
    expect(missingKindCoverage(merged, KNOWN_KIND_IDS)).toBe("simulation");
  });

  it("KindCoverageIncomplete — passes when every known kind has an arm", () => {
    const perKind = KNOWN_KIND_IDS.map((kindId) => ({
      kindId,
      closed: fakeClosedKindSchema(kindId, { $ref: "#/definitions/SomeRealShape" }),
    }));
    const merged = mergeKindSchemas(perKind as never);
    expect(missingKindCoverage(merged, KNOWN_KIND_IDS)).toBeUndefined();
  });

  it("FormatVersionNotConst — fires (returns undefined) when formatVersion has no const", () => {
    expect(formatVersionConst({ type: "object", properties: { formatVersion: { type: "number" } } })).toBeUndefined();
  });

  it("FormatVersionNotConst — passes when formatVersion is a numeric const", () => {
    expect(formatVersionConst({ type: "object", properties: { formatVersion: { type: "number", const: 2 } } })).toBe(2);
  });

  it("ManifestEntryUnidentified — fires when a manifest entry item is missing a required field", () => {
    const items = { type: "object", properties: { id: { type: "string" }, version: { type: "string" } } };
    expect(firstMissingManifestEntryField(items)).toBe("digest");
  });

  it("ManifestEntryUnidentified — passes when every required field is present", () => {
    const items = {
      type: "object",
      properties: { id: { type: "string" }, version: { type: "string" }, digest: { type: "string" } },
    };
    expect(firstMissingManifestEntryField(items)).toBeUndefined();
  });
});
