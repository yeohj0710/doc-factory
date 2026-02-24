import { promises as fs } from "node:fs";
import path from "node:path";
import type { LayoutDocument } from "@/src/layout/types";

export async function writeGeneratedLayoutArtifact(document: LayoutDocument, rootDir = process.cwd()): Promise<void> {
  const targetDir = path.join(rootDir, "src", "generated");
  const targetFile = path.join(targetDir, "layout.json");

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetFile, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

