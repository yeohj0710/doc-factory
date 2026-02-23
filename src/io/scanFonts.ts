import { promises as fs } from "node:fs";
import path from "node:path";

const FONT_EXTENSIONS = new Set([".ttf", ".otf"]);
const naturalCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

export const SYSTEM_FONT_STACK = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

export type ScannedFont = {
  id: string;
  filename: string;
  absPath: string;
  familyName: string;
};

function isFontFile(filename: string): boolean {
  return FONT_EXTENSIONS.has(path.extname(filename).toLowerCase());
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

export async function scanFonts(rootDir = process.cwd()): Promise<ScannedFont[]> {
  const fontsDir = path.join(rootDir, "fonts");
  await fs.mkdir(fontsDir, { recursive: true });

  const entries = await fs.readdir(fontsDir, { withFileTypes: true });
  const fontFiles = entries
    .filter((entry) => entry.isFile() && isFontFile(entry.name))
    .map((entry) => ({
      filename: entry.name,
      absPath: path.join(fontsDir, entry.name),
    }))
    .sort((a, b) => naturalCollator.compare(a.filename, b.filename));

  return fontFiles.map((file, index) => ({
    id: `font-${index + 1}`,
    filename: file.filename,
    absPath: file.absPath,
    familyName: deriveFontFamilyName(file.filename),
  }));
}
