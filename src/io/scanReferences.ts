import { promises as fs } from "node:fs";
import path from "node:path";

const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".pdf",
  ".txt",
  ".md",
]);

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export type ScannedReference = {
  filename: string;
  relPath: string;
  absPath: string;
  group: string;
};

export type ReferenceSampleResult = {
  all: ScannedReference[];
  sampled: ScannedReference[];
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleDeterministic<T>(items: T[], seed: number): T[] {
  const next = [...items];
  let state = (seed >>> 0) || 1;

  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const target = state % (index + 1);
    const swap = next[index];
    next[index] = next[target] as T;
    next[target] = swap as T;
  }

  return next;
}

function isAllowedReference(file: string): boolean {
  return ALLOWED_EXTENSIONS.has(path.extname(file).toLowerCase());
}

async function walkReferences(params: {
  dir: string;
  root: string;
  group: string;
  sink: ScannedReference[];
}): Promise<void> {
  const entries = await fs.readdir(params.dir, { withFileTypes: true });
  entries.sort((a, b) => collator.compare(a.name, b.name));

  for (const entry of entries) {
    const absPath = path.join(params.dir, entry.name);
    if (entry.isDirectory()) {
      const nextGroup = params.group === "root" ? entry.name : params.group;
      await walkReferences({
        dir: absPath,
        root: params.root,
        group: nextGroup,
        sink: params.sink,
      });
      continue;
    }

    if (!entry.isFile() || !isAllowedReference(entry.name)) {
      continue;
    }

    params.sink.push({
      filename: entry.name,
      relPath: path.relative(params.root, absPath),
      absPath,
      group: params.group,
    });
  }
}

function sampleStratified(references: ScannedReference[], seed: number): ScannedReference[] {
  if (references.length === 0) {
    return [];
  }

  const groups = new Map<string, ScannedReference[]>();
  for (const reference of references) {
    const bucket = groups.get(reference.group) ?? [];
    bucket.push(reference);
    groups.set(reference.group, bucket);
  }

  for (const [group, bucket] of groups.entries()) {
    groups.set(group, shuffleDeterministic(bucket, seed + hashString(group)));
  }

  const target = Math.min(16, Math.max(8, Math.min(references.length, 16)));
  const sampled: ScannedReference[] = [];
  const orderedGroups = [...groups.keys()].sort((a, b) => collator.compare(a, b));

  for (const group of orderedGroups) {
    const bucket = groups.get(group) ?? [];
    const candidate = bucket.shift();
    if (candidate) {
      sampled.push(candidate);
    }
    groups.set(group, bucket);
    if (sampled.length >= target) {
      return sampled;
    }
  }

  while (sampled.length < target) {
    let appended = false;
    for (const group of orderedGroups) {
      const bucket = groups.get(group) ?? [];
      const candidate = bucket.shift();
      if (candidate) {
        sampled.push(candidate);
        appended = true;
      }
      groups.set(group, bucket);
      if (sampled.length >= target) {
        return sampled;
      }
    }
    if (!appended) {
      break;
    }
  }

  return sampled;
}

export async function scanReferences(rootDir = process.cwd(), seed = 1): Promise<ReferenceSampleResult> {
  const referencesDir = path.join(rootDir, "references");

  try {
    const stat = await fs.stat(referencesDir);
    if (!stat.isDirectory()) {
      return { all: [], sampled: [] };
    }
  } catch {
    return { all: [], sampled: [] };
  }

  const all: ScannedReference[] = [];
  await walkReferences({
    dir: referencesDir,
    root: referencesDir,
    group: "root",
    sink: all,
  });

  all.sort((a, b) => collator.compare(a.relPath, b.relPath));
  const sampled = sampleStratified(all, seed);

  return { all, sampled };
}

