/**
 * Resolves the pinned `@the-running-dev/game-engine` package from `node_modules` — ordinary Node
 * module resolution, never a network fetch — and reads its `SessionStore` declaration through the
 * TypeScript compiler API (`ts-morph`). This is the one place the generator looks at the engine's
 * own types; everything downstream works from what this module reports.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { Project, SyntaxKind } from "ts-morph";

const ENGINE_PACKAGE_NAME = "@the-running-dev/game-engine";
const ENGINE_REGISTRY = "https://npm.pkg.github.com";

export interface EngineParameter {
  readonly name: string;
  readonly optional: boolean;
  /** The parameter's resolved type, printed by the checker — a self-contained `import("...").T`
   *  reference where the type is named, so the synthetic source needs no import of its own. */
  readonly typeText: string;
  /** True when the parameter's own type is an object shape (e.g. `CreateSessionConfig`) rather
   *  than a scalar. A single object-shaped parameter *is* the wire request body, flattened; a
   *  scalar parameter becomes a named field on a synthesized request object — see `schema-gen.ts`. */
  readonly isObjectShaped: boolean;
}

export interface EngineMethod {
  readonly name: string;
  readonly parameters: readonly EngineParameter[];
  /** The method's return type with any `Promise<...>` wrapper removed. */
  readonly responseTypeText: string;
}

export interface ResolvedEngine {
  readonly version: string;
  readonly entryDeclarationPath: string;
  /** The resolved package's `dist` directory — the root every parameter/return type's printed
   *  `import("...")` specifier resolves under. */
  readonly distRoot: string;
  readonly methods: readonly EngineMethod[];
}

export class EngineResolutionError extends Error {
  constructor(
    readonly packageName: string,
    readonly registry: string,
  ) {
    super(`cannot resolve ${packageName} from ${registry}`);
    this.name = "EngineResolutionError";
  }
}

/** Resolves the engine package's entry declaration file and package version straight off
 *  `node_modules` — plain filesystem paths, not Node's own resolver: `import.meta.resolve` has no
 *  synchronous equivalent under every runner this generator runs in (Vitest's SSR transform, for
 *  one, does not implement it at all), and `require.resolve` cannot follow the engine's `"exports"`
 *  map, which declares an `"import"` condition only. Ordinary `node_modules` layout — a package
 *  manager put it exactly where its name says — is the one thing every one of those runners agrees
 *  on, and it is never a network fetch either way. */
function resolveEnginePackage(projectRoot: string): { entryDeclarationPath: string; version: string } {
  const packageDir = join(projectRoot, "node_modules", "@the-running-dev", "game-engine");
  const packageJsonPath = join(packageDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new EngineResolutionError(ENGINE_PACKAGE_NAME, ENGINE_REGISTRY);
  }
  let packageJson: { version: string; exports?: { ["."]?: { types?: string } }; types?: string };
  try {
    packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch {
    throw new EngineResolutionError(ENGINE_PACKAGE_NAME, ENGINE_REGISTRY);
  }
  const typesEntry = packageJson.exports?.["."]?.types ?? packageJson.types;
  if (!typesEntry) {
    throw new EngineResolutionError(ENGINE_PACKAGE_NAME, ENGINE_REGISTRY);
  }
  const entryDeclarationPath = join(packageDir, typesEntry);
  if (!existsSync(entryDeclarationPath)) {
    throw new EngineResolutionError(ENGINE_PACKAGE_NAME, ENGINE_REGISTRY);
  }
  return { entryDeclarationPath, version: packageJson.version };
}

/** Reads the `SessionStore` interface's method names and parameter names straight off the engine's
 *  own declaration — nothing here is hand-maintained, so it cannot fall behind the engine.
 *  `projectRoot` is the directory `node_modules` resolution should start from. */
export function resolveEngine(projectRoot: string): ResolvedEngine {
  const { entryDeclarationPath, version } = resolveEnginePackage(projectRoot);

  const project = new Project({
    compilerOptions: { strict: true, skipLibCheck: true },
  });
  const sourceFile = project.addSourceFileAtPath(entryDeclarationPath);

  const exported = sourceFile.getExportedDeclarations().get("SessionStore");
  if (!exported || exported.length === 0) {
    throw new EngineResolutionError(ENGINE_PACKAGE_NAME, ENGINE_REGISTRY);
  }
  const decl = exported[0];
  if (decl.getKind() !== SyntaxKind.InterfaceDeclaration) {
    throw new EngineResolutionError(ENGINE_PACKAGE_NAME, ENGINE_REGISTRY);
  }
  const iface = decl.asKindOrThrow(SyntaxKind.InterfaceDeclaration);

  const methods: EngineMethod[] = iface.getMethods().map((method) => {
    const returnType = method.getReturnType();
    const isPromise = returnType.getSymbol()?.getName() === "Promise";
    const responseType = isPromise ? returnType.getTypeArguments()[0] : returnType;
    return {
      name: method.getName(),
      parameters: method.getParameters().map((param) => {
        const paramType = param.getType();
        return {
          name: param.getName(),
          optional: param.isOptional(),
          typeText: paramType.getText(),
          isObjectShaped:
            !paramType.isString() &&
            !paramType.isNumber() &&
            !paramType.isBoolean() &&
            !paramType.isArray() &&
            paramType.getProperties().length > 0,
        };
      }),
      responseTypeText: (responseType ?? returnType).getText(),
    };
  });

  return { version, entryDeclarationPath, distRoot: dirname(entryDeclarationPath), methods };
}

export interface ResolvedEngineType {
  readonly name: string;
  /** The `.d.ts` the declaration actually lives in — `getExportedDeclarations()` returns the
   *  declaration itself, so a type re-exported through the package's entry point (as every
   *  `Portable*` type is, through `index.ts`) reports its real home
   *  (`dist/portable/format.d.ts`), which is the specifier the synthetic projection source
   *  needs. Importing from the entry declaration instead would work for a plain re-export,
   *  but not in general — nothing here should depend on every future type staying a plain
   *  re-export. */
  readonly declarationFilePath: string;
}

export interface ResolvedEngineTypes {
  readonly version: string;
  readonly entryDeclarationPath: string;
  readonly distRoot: string;
  readonly types: readonly ResolvedEngineType[];
}

export class EngineTypeNotFoundError extends Error {
  constructor(
    readonly packageName: string,
    readonly typeName: string,
  ) {
    super(`${packageName} does not export a type named "${typeName}"`);
    this.name = "EngineTypeNotFoundError";
  }
}

/**
 * Reads named type declarations — an interface or a type alias — straight off the engine's
 * own entry declaration, the same way `resolveEngine` reads `SessionStore`'s methods.
 * Additive: does not touch `resolveEngine` or anything it returns, so every gate built on
 * top of that function is unaffected by this one existing.
 */
export function resolveEngineTypes(projectRoot: string, typeNames: readonly string[]): ResolvedEngineTypes {
  const { entryDeclarationPath, version } = resolveEnginePackage(projectRoot);

  const project = new Project({
    compilerOptions: { strict: true, skipLibCheck: true },
  });
  const sourceFile = project.addSourceFileAtPath(entryDeclarationPath);
  const exportedDeclarations = sourceFile.getExportedDeclarations();

  const types: ResolvedEngineType[] = typeNames.map((typeName) => {
    const exported = exportedDeclarations.get(typeName);
    if (!exported || exported.length === 0) {
      throw new EngineTypeNotFoundError(ENGINE_PACKAGE_NAME, typeName);
    }
    const decl = exported[0]!;
    const kind = decl.getKind();
    if (kind !== SyntaxKind.InterfaceDeclaration && kind !== SyntaxKind.TypeAliasDeclaration) {
      throw new EngineTypeNotFoundError(ENGINE_PACKAGE_NAME, typeName);
    }
    return { name: typeName, declarationFilePath: decl.getSourceFile().getFilePath() };
  });

  return { version, entryDeclarationPath, distRoot: dirname(entryDeclarationPath), types };
}
