/**
 * Projects JSON Schema documents from the engine's own declared parameter and return types.
 * Nothing here is hand-authored: a request shape's members are the store method's own parameter
 * names, and a response shape is the store method's own return type, unwrapped from `Promise`.
 * Rule 1 ("projected, never authored") is what this module exists to satisfy.
 */
import { mkdtempSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createGenerator } from "ts-json-schema-generator";
import type { EngineMethod } from "./engine-introspect.js";

export const SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";

function pascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function requestTypeName(methodName: string): string {
  return `${pascalCase(methodName)}Request`;
}

export function responseTypeName(methodName: string): string {
  return `${pascalCase(methodName)}Response`;
}

const IMPORT_TYPE_PATTERN = /import\("([^"]+)"\)\.([A-Za-z0-9_]+)/g;

/** Every field type here is already the checker's fully-resolved text for that engine parameter or
 *  return type (`engine-introspect.ts`), printed as a self-contained `import("...").T` reference
 *  into the engine's own installed `.d.ts` tree. `ts-json-schema-generator` treats anything under
 *  `node_modules` as an opaque external file and will not expand its interfaces, so this rewrites
 *  each reference to a bare name backed by an `import type` from a **local copy** of the engine's
 *  declaration tree (`vendorEngineDeclarations`) — the types are still entirely the engine's, only
 *  their file location changes for the one call that reads them. */
function buildSyntheticSource(methods: readonly EngineMethod[], distRoot: string): string {
  const imports = new Map<string, Set<string>>();
  const rewrite = (typeText: string): string =>
    typeText.replace(IMPORT_TYPE_PATTERN, (_match, specifier: string, name: string) => {
      const relativeSpecifier = relative(distRoot, specifier).split(sep).join("/");
      const localSpecifier = `./engine/${relativeSpecifier}.js`;
      let names = imports.get(localSpecifier);
      if (!names) {
        names = new Set();
        imports.set(localSpecifier, names);
      }
      names.add(name);
      return name;
    });

  const body: string[] = [];
  for (const method of methods) {
    // A single object-shaped parameter (`createSession(config: CreateSessionConfig)`) *is* the
    // wire request body — its own members, not wrapped under a synthesized `config` field. A
    // scalar parameter, or more than one parameter, becomes a named field on a synthesized
    // request object instead (`getScene(sessionId: string)` -> `{ sessionId: string }`).
    const requestType =
      method.parameters.length === 1 && method.parameters[0]!.isObjectShaped
        ? rewrite(method.parameters[0]!.typeText)
        : `{${
            method.parameters.length
              ? `\n${method.parameters
                  .map((param) => `  ${param.name}${param.optional ? "?" : ""}: ${rewrite(param.typeText)};`)
                  .join("\n")}\n`
              : ""
          }}`;
    body.push(`export type ${requestTypeName(method.name)} = ${requestType};`);
    body.push(`export type ${responseTypeName(method.name)} = ${rewrite(method.responseTypeText)};`);
    body.push("");
  }

  const importLines = [...imports.entries()].map(
    ([specifier, names]) => `import type { ${[...names].sort().join(", ")} } from "${specifier}";`,
  );
  return [...importLines, "", ...body].join("\n");
}

export interface RawSchema {
  readonly [keyword: string]: unknown;
}

/** One synthetic source file, one generator, one schema per named type — self-contained (no
 *  cross-document `$ref`), which is what lets each row's requestShape/responseShape stand alone.
 *  `distRoot` is the resolved engine package's `dist` directory (`ResolvedEngine.entryDeclarationPath`'s
 *  parent) — its declarations are copied alongside the synthetic file so the generator sees them as
 *  ordinary project files rather than opaque `node_modules` ones. */
export function projectSchemas(
  projectRoot: string,
  methods: readonly EngineMethod[],
  distRoot: string,
): ReadonlyMap<string, RawSchema> {
  const dir = mkdtempSync(join(projectRoot, ".contract-gen-"));
  const engineCopyDir = join(dir, "engine");
  cpSync(distRoot, engineCopyDir, { recursive: true, filter: (src) => !src.endsWith(".js.map") });

  const sourcePath = join(dir, "session-store-shapes.d.ts");
  writeFileSync(sourcePath, buildSyntheticSource(methods, distRoot), "utf8");

  const tsconfigPath = join(dir, "tsconfig.json");
  writeFileSync(
    tsconfigPath,
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
      },
      include: ["*.d.ts", "engine/**/*.d.ts"],
    }),
    "utf8",
  );

  const typeNames = methods.flatMap((m) => [requestTypeName(m.name), responseTypeName(m.name)]);
  const results = new Map<string, RawSchema>();
  try {
    for (const typeName of typeNames) {
      const generator = createGenerator({
        path: sourcePath,
        tsconfig: tsconfigPath,
        type: typeName,
        topRef: false,
        expose: "all",
        additionalProperties: false,
        jsDoc: "none",
        sortProps: true,
        skipTypeCheck: false,
      });
      const schema = generator.createSchema(typeName) as RawSchema;
      results.set(typeName, schema);
    }
  } finally {
    // Best-effort: on Windows, a just-closed file handle (editor indexing, sync clients) can
    // still hold the directory briefly. The scratch directory is unique per call and harmless
    // to leave behind for the OS to reclaim; `.gitignore` excludes it either way.
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup only */
    }
  }
  return results;
}
