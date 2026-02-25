import { promises as fs } from "node:fs";
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

  try {
    const raw = await fs.readFile(filePath, "utf8");
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

  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, payload, "utf8");

  await fs.mkdir(path.dirname(exportPath), { recursive: true });
  await fs.writeFile(exportPath, payload, "utf8");
}
