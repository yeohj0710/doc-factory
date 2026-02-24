import { promises as fs } from "node:fs";
import path from "node:path";
import { sha256HexShort } from "@/src/io/hash";
import { parseImageDimensions } from "@/src/io/imageProbe";
import { compareOrderedAssetPath } from "@/src/io/ordering";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

type RawImage = {
  id: string;
  filename: string;
  absPath: string;
  widthPx?: number;
  heightPx?: number;
};

export type ScannedImage = {
  id: string;
  filename: string;
  absPath: string;
  publicPath: string;
  widthPx?: number;
  heightPx?: number;
};

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function publicPathForFilename(filename: string): string {
  return `/api/assets/images/${encodeURIComponent(filename)}`;
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

export async function scanImages(rootDir = process.cwd()): Promise<ScannedImage[]> {
  const imagesDir = path.join(rootDir, "images");
  const entries = await readDirIfExists(imagesDir);

  const imageCandidates = await Promise.all(
    entries.map(async (entry): Promise<RawImage | null> => {
      if (!entry.isFile() || !isImageFile(entry.name)) {
        return null;
      }

      const absPath = path.join(imagesDir, entry.name);
      const bytes = await fs.readFile(absPath);
      const dimensions = parseImageDimensions(bytes);

      return {
        id: sha256HexShort(bytes, 12),
        filename: entry.name,
        absPath,
        widthPx: dimensions?.widthPx,
        heightPx: dimensions?.heightPx,
      };
    }),
  );

  const sortedImages = imageCandidates
    .filter((candidate): candidate is RawImage => candidate !== null)
    .sort((left, right) => compareOrderedAssetPath(left.filename, right.filename));

  return sortedImages.map((image) => ({
    id: image.id,
    filename: image.filename,
    absPath: image.absPath,
    publicPath: publicPathForFilename(image.filename),
    widthPx: image.widthPx,
    heightPx: image.heightPx,
  }));
}
