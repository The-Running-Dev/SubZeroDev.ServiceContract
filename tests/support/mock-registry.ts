/**
 * A minimal npm-registry-protocol server for S2.9, run locally and ephemerally for one test.
 * Real `@subzerodev` npm publishing needs credentials this session doesn't have (issue #81,
 * `90-decisions.md` 2026-08-09) — this proves the same mechanism the real registry enforces
 * (publish under a semantic version, refuse to overwrite one already published) without them.
 */
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";

interface StoredVersion {
  readonly manifest: Record<string, unknown>;
  readonly tarball: Buffer;
  readonly tarballFileName: string;
}

interface PackageDocument {
  readonly name: string;
  readonly versions: Map<string, StoredVersion>;
  distTags: Record<string, string>;
}

export interface MockRegistry {
  readonly url: string;
  close(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function startMockRegistry(): Promise<MockRegistry> {
  const packages = new Map<string, PackageDocument>();

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = decodeURIComponent(url.pathname);

    if (req.method === "PUT") {
      const packageName = path.replace(/^\//, "");
      const body = JSON.parse((await readBody(req)).toString("utf8")) as {
        versions: Record<string, Record<string, unknown>>;
        _attachments: Record<string, { data: string }>;
      };
      const [version] = Object.keys(body.versions);
      let doc = packages.get(packageName);
      if (!doc) {
        doc = { name: packageName, versions: new Map(), distTags: {} };
        packages.set(packageName, doc);
      }
      if (doc.versions.has(version)) {
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `cannot publish over previously published version ${version}` }));
        return;
      }
      const [attachmentName, attachment] = Object.entries(body._attachments)[0]!;
      doc.versions.set(version, {
        manifest: body.versions[version]!,
        tarball: Buffer.from(attachment.data, "base64"),
        tarballFileName: attachmentName,
      });
      doc.distTags["latest"] = version;
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "GET" && path.includes("/-/")) {
      const [packageName, fileName] = path.slice(1).split("/-/");
      const doc = packages.get(packageName!);
      const stored = doc && [...doc.versions.values()].find((v) => v.tarballFileName === fileName);
      if (!stored) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      res.end(stored.tarball);
      return;
    }

    if (req.method === "GET") {
      const packageName = path.replace(/^\//, "");
      const doc = packages.get(packageName);
      if (!doc) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
        return;
      }
      const versions: Record<string, Record<string, unknown>> = {};
      for (const [version, stored] of doc.versions) {
        versions[version] = {
          ...stored.manifest,
          dist: {
            tarball: `http://${req.headers.host}/${packageName}/-/${stored.tarballFileName}`,
            shasum: "",
          },
        };
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ name: packageName, "dist-tags": doc.distTags, versions }));
      return;
    }

    res.writeHead(405);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("mock registry failed to bind a port");
  }
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
