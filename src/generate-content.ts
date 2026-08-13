/**
 * `generateContent` — the content-document contract's analogue of `generate.ts`'s `generate`.
 * Every gate this boundary needs runs inside it; a gate failure returns a
 * `ContentGenerationError` and produces no artifact, the same discipline `generate` follows.
 */
import { relative, sep } from "node:path";
import { resolveEngineTypes, resolveEngineVersion, EngineTypeNotFoundError } from "./engine-introspect.js";
import { projectDocumentSchemas, generateSchemas, documentTypeName, withProjectionWorkspace, SCHEMA_DIALECT } from "./schema-gen.js";
import { closeSchema } from "./schema-close.js";
import { schemaId } from "./schema-id.js";
import { mergeKindSchemas } from "./content-merge.js";
import type { ClosedKindSchema, JsonRecord } from "./content-merge.js";
import {
  opaqueContentPayload,
  missingKindCoverage,
  formatVersionConst,
  firstMissingManifestEntryField,
  resolveNode,
  propertiesOf,
} from "./content-gates.js";
import { isFullyClosed, reachesEnvelope, hasTopLevelMember } from "./generate.js";
import { KNOWN_KIND_IDS } from "./documents.js";
import type {
  AuthoredDocumentRow,
  ContentContractPackage,
  ContentDocumentRow,
  ContentGenerationError,
  ContentGenerationInput,
  JsonSchemaDocument,
  Outcome,
} from "./types.js";

function fail(error: ContentGenerationError): Outcome<ContentContractPackage, ContentGenerationError> {
  return { ok: false, error };
}

function findRow(rows: readonly AuthoredDocumentRow[], documentId: string): AuthoredDocumentRow | undefined {
  return rows.find((row) => (row.documentId as string) === documentId);
}

/** `kindId` is kebab-case ("story-graph"); `documentTypeName` only capitalizes the first
 *  letter, which would leave a hyphen in the middle of a TS identifier. This produces a valid
 *  one directly rather than routing through that helper. */
function campaignKindTypeName(kindId: string): string {
  const pascalKind = kindId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `Campaign${pascalKind}Document`;
}

/** `Omit<PortableCampaign, "campaign"> & { campaign: Extract<PortableCampaignBody, {kindId:
 *  K}> }` — the type-level narrowing that lets one kind's campaign document be requested as
 *  its own root, avoiding the cross-kind name collision `content-merge.ts` documents
 *  (verified: each kind alone projects cleanly; the union in one request does not). */
function buildCampaignKindSource(specifier: string, kindId: string): string {
  const typeName = campaignKindTypeName(kindId);
  return [
    `import type { PortableCampaign, PortableCampaignBody } from "${specifier}";`,
    `export type ${typeName} = Omit<PortableCampaign, "campaign"> & {`,
    `  campaign: Extract<PortableCampaignBody, { kindId: "${kindId}" }>;`,
    `};`,
    "",
  ].join("\n");
}

function engineSpecifier(distRoot: string, declarationFilePath: string): string {
  const relativeSpecifier = relative(distRoot, declarationFilePath)
    .replace(/\.d\.ts$/, "")
    .split(sep)
    .join("/");
  return `./engine/${relativeSpecifier}.js`;
}

export function generateContent(
  input: ContentGenerationInput,
): Promise<Outcome<ContentContractPackage, ContentGenerationError>> {
  return Promise.resolve(generateContentSync(input));
}

function generateContentSync(input: ContentGenerationInput): Outcome<ContentContractPackage, ContentGenerationError> {
  // Same gate, and the same reasoning, as the RPC generator's `EngineVersionMismatch` — this
  // artifact stamps an authored `engineVersion` too. Checked first, off a bare `package.json`
  // read, so an engine that disagrees with its pin costs nothing to discover.
  const resolvedVersion = resolveEngineVersion(process.cwd());
  if (input.engineVersion !== resolvedVersion) {
    return fail({
      code: "EngineVersionMismatch",
      authored: input.engineVersion as string,
      resolved: resolvedVersion,
    });
  }

  const seen = new Map<string, AuthoredDocumentRow>();
  for (const row of input.rows) {
    const key = row.documentId as string;
    const clash = seen.get(key);
    if (clash) return fail({ code: "DuplicateDocumentId", first: clash.documentId as string, second: key });
    seen.set(key, row);
  }

  const manifestRow = findRow(input.rows, "manifest");
  const campaignRow = findRow(input.rows, "campaign");
  // Both documents are required for this generator's own cross-document invariants
  // (FormatVersionMismatch, ContentRootVersionMismatch) to mean anything — a row set missing
  // either is not a smaller valid contract, it is an incomplete one.
  if (!manifestRow) return fail({ code: "EngineTypeMissing", typeName: "PortableManifest" });
  if (!campaignRow) return fail({ code: "EngineTypeMissing", typeName: "PortableCampaign" });

  let resolvedManifest;
  try {
    resolvedManifest = resolveEngineTypes(process.cwd(), [manifestRow.engineType as string]);
  } catch (error) {
    if (error instanceof EngineTypeNotFoundError) return fail({ code: "EngineTypeMissing", typeName: error.typeName });
    throw error;
  }

  let resolvedCampaign;
  try {
    resolvedCampaign = resolveEngineTypes(process.cwd(), ["PortableCampaign", "PortableCampaignBody"]);
  } catch (error) {
    if (error instanceof EngineTypeNotFoundError) return fail({ code: "EngineTypeMissing", typeName: error.typeName });
    throw error;
  }

  // --- Manifest document: the generic single-type projection path ---
  const manifestTypeName = documentTypeName(manifestRow.engineType as string);
  const manifestRaw = projectDocumentSchemas(process.cwd(), resolvedManifest.types, resolvedManifest.distRoot).get(
    manifestTypeName,
  );
  if (!manifestRaw) return fail({ code: "EngineTypeMissing", typeName: manifestRow.engineType as string });

  for (const field of manifestRow.narrowings) {
    if (!hasTopLevelMember(manifestRaw as JsonRecord, field)) {
      return fail({ code: "NarrowingUnknownField", document: manifestRow.documentId as string, field });
    }
  }
  const manifestClosed = closeSchema(manifestRaw, { narrowFields: [...manifestRow.narrowings] });
  if (!isFullyClosed(manifestClosed)) return fail({ code: "DocumentSchemaOpen", document: manifestRow.documentId as string });
  if (reachesEnvelope(manifestClosed)) return fail({ code: "EnvelopeReachable", document: manifestRow.documentId as string });

  const manifestDefinitions = (manifestClosed["definitions"] ?? {}) as Readonly<Record<string, JsonRecord>>;
  const manifestRoot = resolveNode(manifestClosed as JsonRecord, manifestDefinitions);
  const manifestFormatVersion = formatVersionConst(manifestRoot);
  if (manifestFormatVersion === undefined) {
    return fail({ code: "FormatVersionNotConst", document: manifestRow.documentId as string });
  }

  const campaignsNode = propertiesOf(manifestRoot)["campaigns"];
  const campaignsResolved =
    campaignsNode && typeof campaignsNode === "object"
      ? resolveNode(campaignsNode as JsonRecord, manifestDefinitions)
      : {};
  const itemsRaw = (campaignsResolved as JsonRecord)["items"];
  const itemsResolved = itemsRaw && typeof itemsRaw === "object" ? resolveNode(itemsRaw as JsonRecord, manifestDefinitions) : {};
  const missingField = firstMissingManifestEntryField(itemsResolved as JsonRecord);
  if (missingField) return fail({ code: "ManifestEntryUnidentified", missingField });

  // --- Campaign document: project each kind alone, then merge (content-merge.ts) ---
  const campaignDeclarationPath = resolvedCampaign.types.find((t) => t.name === "PortableCampaign")?.declarationFilePath;
  if (!campaignDeclarationPath) return fail({ code: "EngineTypeMissing", typeName: "PortableCampaign" });
  const specifier = engineSpecifier(resolvedCampaign.distRoot, campaignDeclarationPath);

  const perKind: ClosedKindSchema[] = [];
  for (const kindId of KNOWN_KIND_IDS) {
    const typeName = campaignKindTypeName(kindId);
    const raw = withProjectionWorkspace(
      process.cwd(),
      `campaign-${kindId}-shape.d.ts`,
      buildCampaignKindSource(specifier, kindId),
      resolvedCampaign.distRoot,
      (sourcePath, tsconfigPath) => generateSchemas(sourcePath, tsconfigPath, [typeName]),
    ).get(typeName);
    if (!raw) return fail({ code: "EngineTypeMissing", typeName: campaignRow.engineType as string });

    for (const field of campaignRow.narrowings) {
      if (!hasTopLevelMember(raw as JsonRecord, field)) {
        return fail({ code: "NarrowingUnknownField", document: campaignRow.documentId as string, field });
      }
    }
    const closed = closeSchema(raw, { narrowFields: [...campaignRow.narrowings] });
    if (!isFullyClosed(closed)) return fail({ code: "DocumentSchemaOpen", document: campaignRow.documentId as string });
    if (reachesEnvelope(closed)) return fail({ code: "EnvelopeReachable", document: campaignRow.documentId as string });
    perKind.push({ kindId, closed: closed as JsonRecord });
  }

  const merged = mergeKindSchemas(perKind);

  const missingKind = missingKindCoverage(merged, KNOWN_KIND_IDS);
  if (missingKind) return fail({ code: "KindCoverageIncomplete", kindId: missingKind });

  const opaqueKind = opaqueContentPayload(merged);
  if (opaqueKind) return fail({ code: "OpaqueContentPayload", document: campaignRow.documentId as string, kindId: opaqueKind });

  const campaignFormatVersions = new Set<number>();
  for (const arm of merged.anyOf) {
    const resolvedArm = resolveNode(arm, merged.definitions);
    const value = formatVersionConst(resolvedArm);
    if (value === undefined) return fail({ code: "FormatVersionNotConst", document: campaignRow.documentId as string });
    campaignFormatVersions.add(value);
  }
  if (campaignFormatVersions.size > 1) {
    return fail({ code: "FormatVersionMismatch", first: `${campaignRow.documentId as string}[0]`, second: `${campaignRow.documentId as string}[1]` });
  }
  const [campaignFormatVersion] = campaignFormatVersions;
  if (campaignFormatVersion === undefined || campaignFormatVersion !== manifestFormatVersion) {
    return fail({ code: "FormatVersionMismatch", first: manifestRow.documentId as string, second: campaignRow.documentId as string });
  }

  const versionSegment = `v${manifestFormatVersion}`;
  if (!input.contentRoot.endsWith(versionSegment)) {
    return fail({ code: "ContentRootVersionMismatch", contentRoot: input.contentRoot, formatVersion: manifestFormatVersion });
  }

  // --- Assemble the artifact ---
  const manifestShape = schemaId("content-contract", versionSegment, "manifest");
  const campaignShape = schemaId("content-contract", versionSegment, "campaign");

  const campaignSchema: JsonRecord = {
    $id: campaignShape,
    $schema: SCHEMA_DIALECT,
    anyOf: merged.anyOf,
    definitions: merged.definitions,
  };

  const schemas: JsonSchemaDocument[] = [
    { $id: manifestShape, $schema: SCHEMA_DIALECT as JsonSchemaDocument["$schema"], ...manifestClosed },
    campaignSchema as unknown as JsonSchemaDocument,
  ];

  const documents: ContentDocumentRow[] = [
    { ...manifestRow, documentShape: manifestShape },
    { ...campaignRow, documentShape: campaignShape },
  ];

  const contract: ContentContractPackage = {
    contractKind: "content-document",
    contractVersion: input.contractVersion,
    engineVersion: input.engineVersion,
    formatVersion: manifestFormatVersion,
    contentRoot: input.contentRoot,
    documents,
    schemas,
    digestAlgorithm: "sha-256",
  };

  return { ok: true, value: contract };
}
