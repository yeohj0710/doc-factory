import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { sha256Hex, stableHashFromParts } from "@/src/io/hash";
import type { CopyDeck, CopyDeckCacheRecord } from "@/src/copywriter/types";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function cacheFilePath(rootDir: string, cacheKey: string): string {
  return path.join(rootDir, ".cache", "copy", `${cacheKey}.json`);
}

function exportMirrorPath(rootDir: string, requestHash: string, cacheKey: string): string {
  return path.join(rootDir, "exports", requestHash, "copy", `${cacheKey}.json`);
}

// 서버리스에 올리면 앱 폴더가 읽기 전용이라 여기에 못 쓴다. 쓸 수 있는 곳은 임시 폴더뿐이다.
// 배포된 사이트가 `mkdir '/var/task/.cache'` 로 500 을 뱉고 있었다.
function writableRoot(): string {
  return path.join(os.tmpdir(), "doc-factory");
}

const UNWRITABLE = new Set(["EROFS", "EACCES", "EPERM", "ENOENT"]);

// 저장소에 커밋해둔 캐시가 먼저다. 없으면 임시 폴더에 남긴 것을 본다.
async function readEither(primary: string, fallback: string): Promise<string> {
  try {
    return await fs.readFile(primary, "utf8");
  } catch {
    return await fs.readFile(fallback, "utf8");
  }
}

// 저장소 안에 먼저 쓰고, 못 쓰는 자리면 임시 폴더에 쓴다.
// 로컬에서는 지금까지처럼 저장소에 쌓이고, 배포판에서는 임시 폴더로 간다.
async function writeWhereWeCan(primary: string, fallback: string, payload: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(primary, payload, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "";
    if (!UNWRITABLE.has(code)) {
      throw error;
    }
    await fs.mkdir(path.dirname(fallback), { recursive: true });
    await fs.writeFile(fallback, payload, "utf8");
  }
}

export function buildImageDigest(orderedImageIds: string[]): string {
  return stableHashFromParts([orderedImageIds.join(",")], 24);
}

export function buildCopyCacheKey(params: {
  requestHash: string;
  promptVersion: string;
  schemaVersion: string;
  model: string;
  referenceDigest?: string;
  imageDigest?: string;
}): string {
  return sha256Hex(
    [
      params.requestHash,
      params.promptVersion,
      params.schemaVersion,
      params.model,
      params.referenceDigest ?? "none",
      params.imageDigest ?? "none",
    ].join("|"),
  );
}

export function hashCopyDeck(deck: CopyDeck): string {
  return sha256Hex(stableStringify(deck));
}

export async function readCopyDeckCache(params: {
  rootDir: string;
  cacheKey: string;
}): Promise<CopyDeckCacheRecord | null> {
  const filePath = cacheFilePath(params.rootDir, params.cacheKey);
  const spare = cacheFilePath(writableRoot(), params.cacheKey);

  try {
    const raw = await readEither(filePath, spare);
    const parsed = JSON.parse(raw) as CopyDeckCacheRecord;
    if (!parsed || parsed.cacheKey !== params.cacheKey || !parsed.copyDeck) {
      return null;
    }
    return parsed;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }
    return null;
  }
}

export async function writeCopyDeckCache(params: {
  rootDir: string;
  requestHash: string;
  record: CopyDeckCacheRecord;
}): Promise<void> {
  const cachePath = cacheFilePath(params.rootDir, params.record.cacheKey);
  const exportPath = exportMirrorPath(params.rootDir, params.requestHash, params.record.cacheKey);
  const payload = `${JSON.stringify(params.record, null, 2)}\n`;

  await writeWhereWeCan(cachePath, cacheFilePath(writableRoot(), params.record.cacheKey), payload);
  await writeWhereWeCan(
    exportPath,
    exportMirrorPath(writableRoot(), params.requestHash, params.record.cacheKey),
    payload,
  );
}
