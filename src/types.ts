/**
 * Contract package types. `design/20-contract.md` in `SubZeroDev.Platform` is authoritative for
 * every signature here — this file declares exactly what that document names, nothing more.
 */

export type OperationId = string & { readonly __brand: "OperationId" };
export type StoreMethodName = string & { readonly __brand: "StoreMethodName" };
export type McpToolName = string & { readonly __brand: "McpToolName" };
export type HttpPathSegment = string & { readonly __brand: "HttpPathSegment" };
export type WireVersion = string & { readonly __brand: "WireVersion" };
export type SchemaRef = string & { readonly __brand: "SchemaRef" };
export type SemanticVersion = string & { readonly __brand: "SemanticVersion" };
export type CanonicalJson = string & { readonly __brand: "CanonicalJson" };
export type CorrelationId = string & { readonly __brand: "CorrelationId" };

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [member: string]: JsonValue;
}

export type EngineErrorCode = string & { readonly __brand: "EngineErrorCode" };

export type TransportErrorCode =
  | "malformed_payload"
  | "unsupported_version"
  | "unknown_operation"
  | "internal_failure";

export type WireErrorCode = EngineErrorCode | TransportErrorCode;

export type HttpStatus = 200 | 400 | 404 | 409 | 500 | 503;

export interface StatusMappingEntry {
  readonly code: WireErrorCode;
  readonly status: HttpStatus;
}

export interface StatusMapping {
  readonly entries: readonly StatusMappingEntry[];
}

export type NarrowingSide = "request" | "response";

export interface NarrowedField {
  readonly side: NarrowingSide;
  readonly field: string;
}

export interface AuthoredRow {
  readonly operation: OperationId;
  readonly storeMethod: StoreMethodName;
  readonly mcpTool: McpToolName;
  readonly narrowings: readonly NarrowedField[];
  readonly reachableErrors: readonly WireErrorCode[];
}

export interface OperationRow extends AuthoredRow {
  readonly httpPath: HttpPathSegment;
  readonly requestShape: SchemaRef;
  readonly responseShape: SchemaRef;
}

export type SchemaDialect = string & { readonly __brand: "SchemaDialect" };

export interface JsonSchemaDocument {
  readonly $id: SchemaRef;
  readonly $schema: SchemaDialect;
  readonly [keyword: string]: JsonValue | undefined;
}

/**
 * Which boundary a package governs. An artifact read off disk is `JSON.parse`'d — this is
 * the one member that says which of this repository's package shapes it is, so a loader
 * never infers that from the filename it happened to open (`readArtifact`, `src/index.ts`).
 */
export type ContractKind = "rpc-surface" | "content-document";

export interface ContractPackageBase {
  readonly contractKind: ContractKind;
  readonly contractVersion: SemanticVersion;
  readonly engineVersion: SemanticVersion;
  readonly schemas: readonly JsonSchemaDocument[];
}

export interface ContractPackage extends ContractPackageBase {
  readonly contractKind: "rpc-surface";
  readonly wireVersion: WireVersion;
  readonly operations: readonly OperationRow[];
  readonly statusMapping: StatusMapping;
}

export type Outcome<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export interface GenerationInput {
  readonly engineVersion: SemanticVersion;
  readonly contractVersion: SemanticVersion;
  readonly wireVersion: WireVersion;
  readonly rows: readonly AuthoredRow[];
  readonly statusMapping: StatusMapping;
}

export type GenerationError =
  | { readonly code: "ArityMismatch"; readonly method?: string; readonly operation?: string }
  | { readonly code: "ErrorCodeUncovered"; readonly wireErrorCode: string }
  | { readonly code: "NarrowingUnknownField"; readonly operation: string; readonly field: string }
  | { readonly code: "ResponseSchemaOpen"; readonly schema: string }
  | { readonly code: "RequestSchemaOpen"; readonly schema: string }
  | { readonly code: "EnvelopeReachable"; readonly schema: string }
  | { readonly code: "DeterminismProfileInRow"; readonly operation: string }
  | { readonly code: "DuplicateOperationId"; readonly first: string; readonly second: string }
  | { readonly code: "EngineResolutionFailed"; readonly packageName: string; readonly registry: string };
