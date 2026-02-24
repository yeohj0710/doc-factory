import { promises as fs } from "node:fs";
import path from "node:path";
import type { LayoutDocument } from "@/src/layout/types";
import type { ExportAuditResult } from "@/src/qa/exportAudit";

export function getJobArtifactDir(requestHash: string, rootDir = process.cwd()): string {
  return path.join(rootDir, "src", "generated", "jobs", requestHash);
}

export async function writeGeneratedLayoutArtifact(params: {
  document: LayoutDocument;
  requestHash: string;
  rootDir?: string;
}): Promise<void> {
  const targetDir = getJobArtifactDir(params.requestHash, params.rootDir ?? process.cwd());
  const targetFile = path.join(targetDir, "layout.json");

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetFile, `${JSON.stringify(params.document, null, 2)}\n`, "utf8");
}

export async function writeExportAuditArtifact(params: {
  audit: ExportAuditResult;
  requestHash: string;
  rootDir?: string;
}): Promise<void> {
  const targetDir = getJobArtifactDir(params.requestHash, params.rootDir ?? process.cwd());
  const targetFile = path.join(targetDir, "export-audit.json");

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetFile, `${JSON.stringify(params.audit, null, 2)}\n`, "utf8");
}
