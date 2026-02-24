import { promises as fs } from "node:fs";
import path from "node:path";
import type { LayoutDocument } from "@/src/layout/types";

export async function clearGeneratedLayoutArtifacts(rootDir = process.cwd()): Promise<string[]> {
  const targetDir = path.join(rootDir, "src", "generated");
  let entries: import("node:fs").Dirent[] = [];

  try {
    entries = await fs.readdir(targetDir, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const deleted: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !/^layout\./i.test(entry.name)) {
      continue;
    }

    await fs.unlink(path.join(targetDir, entry.name));
    deleted.push(entry.name);
  }

  return deleted;
}

export async function writeGeneratedLayoutArtifact(document: LayoutDocument, rootDir = process.cwd()): Promise<void> {
  const targetDir = path.join(rootDir, "src", "generated");
  const targetFile = path.join(targetDir, "layout.json");

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetFile, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}
