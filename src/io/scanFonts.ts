import { promises as fs } from "node:fs";
import path from "node:path";
import { compareOrderedAssetPath } from "@/src/io/ordering";

const FONT_EXTENSIONS = new Set([".ttf", ".otf"]);
export const SYSTEM_FONT_STACK = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

export type ScannedFont = {
  id: string;
  filename: string;
  absPath: string;
  familyName: string;
  publicPath: string;
  weight: number;
  style: "normal";
  format: "truetype" | "opentype";
};

function isFontFile(filename: string): boolean {
  return FONT_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function publicPathForFilename(filename: string): string {
  return `/api/assets/fonts/${encodeURIComponent(filename)}`;
}

function detectFontFormat(filename: string): "truetype" | "opentype" {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".otf") {
    return "opentype";
  }
  return "truetype";
}

function detectFontWeight(filename: string): number {
  const stem = path.parse(filename).name.toLowerCase();

  if (/\bthin\b/.test(stem)) {
    return 100;
  }
  if (/\b(extra[\s-]*light|extralight)\b/.test(stem)) {
    return 200;
  }
  if (/\blight\b/.test(stem)) {
    return 300;
  }
  if (/\b(regular|book)\b/.test(stem)) {
    return 400;
  }
  if (/\bmedium\b/.test(stem)) {
    return 500;
  }
  if (/\b(semi[\s-]*bold|semibold)\b/.test(stem)) {
    return 600;
  }
  if (/\bbold\b/.test(stem) && !/\bextra[\s-]*bold\b/.test(stem)) {
    return 700;
  }
  if (/\b(extra[\s-]*bold|extrabold)\b/.test(stem)) {
    return 800;
  }
  if (/\bblack\b/.test(stem)) {
    return 900;
  }
  return 400;
}

export function deriveFontFamilyName(filename: string): string {
  const stem = path.parse(filename).name;
  const cleaned = stem
    .replace(/[_-]+/g, " ")
    .replace(
      /\b(thin|extra light|extralight|light|regular|book|medium|semi bold|semibold|bold|extra bold|extrabold|black|italic|oblique)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > 0) {
    return cleaned;
  }

  return stem.replace(/[_-]+/g, " ").trim() || "Custom Font";
}

async function readDirIfExists(dirPath: string): Promise<import("node:fs").Dirent[]> {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function scanFonts(rootDir = process.cwd()): Promise<ScannedFont[]> {
  const fontsDir = path.join(rootDir, "fonts");
  const entries = await readDirIfExists(fontsDir);
  const fontFiles = entries
    .filter((entry) => entry.isFile() && isFontFile(entry.name))
    .map((entry) => ({
      filename: entry.name,
      absPath: path.join(fontsDir, entry.name),
    }))
    .sort((a, b) => compareOrderedAssetPath(a.filename, b.filename));

  return fontFiles.map((file, index) => ({
    id: `font-${index + 1}`,
    filename: file.filename,
    absPath: file.absPath,
    familyName: deriveFontFamilyName(file.filename),
    publicPath: publicPathForFilename(file.filename),
    weight: detectFontWeight(file.filename),
    style: "normal",
    format: detectFontFormat(file.filename),
  }));
}
