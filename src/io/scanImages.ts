import { promises as fs } from "node:fs";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const naturalCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

type ImageDimensions = {
  widthPx: number;
  heightPx: number;
};

type RawImage = {
  filename: string;
  absPath: string;
  mtimeMs: number;
  leadingNumber: number | null;
  widthPx?: number;
  heightPx?: number;
};

export type ScannedImage = {
  id: string;
  filename: string;
  absPath: string;
  publicPath: string;
  mtimeMs: number;
  widthPx?: number;
  heightPx?: number;
};

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function parseLeadingNumber(filename: string): number | null {
  const stem = path.parse(filename).name;
  const patterns = [
    /^\s*0*(\d+)(?=[\s._-]|$)/,
    /^\s*p\s*0*(\d+)(?=[\s._-]|$)/i,
    /^\s*\(\s*0*(\d+)\s*\)(?=[\s._-]|$)/,
  ];

  for (const pattern of patterns) {
    const match = stem.match(pattern);
    if (match?.[1]) {
      const parsed = Number.parseInt(match[1], 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function publicPathForFilename(filename: string): string {
  return `/api/assets/images/${encodeURIComponent(filename)}`;
}

function compareImages(a: RawImage, b: RawImage): number {
  if (a.leadingNumber !== null || b.leadingNumber !== null) {
    if (a.leadingNumber === null) {
      return 1;
    }
    if (b.leadingNumber === null) {
      return -1;
    }

    const byNumber = a.leadingNumber - b.leadingNumber;
    if (byNumber !== 0) {
      return byNumber;
    }
  }

  const byMtime = a.mtimeMs - b.mtimeMs;
  if (byMtime !== 0) {
    return byMtime;
  }

  return naturalCollator.compare(a.filename, b.filename);
}

function parsePngDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 24) {
    return undefined;
  }

  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return undefined;
  }

  const widthPx = buffer.readUInt32BE(16);
  const heightPx = buffer.readUInt32BE(20);

  if (widthPx <= 0 || heightPx <= 0) {
    return undefined;
  }

  return { widthPx, heightPx };
}

function parseJpegDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return undefined;
  }

  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);

  let offset = 2;

  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (buffer[offset] === 0xff) {
      offset += 1;
      if (offset >= buffer.length) {
        return undefined;
      }
    }

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0x01) {
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (offset + 1 >= buffer.length) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      break;
    }

    if (sofMarkers.has(marker)) {
      if (segmentLength >= 7) {
        const heightPx = buffer.readUInt16BE(offset + 3);
        const widthPx = buffer.readUInt16BE(offset + 5);
        if (widthPx > 0 && heightPx > 0) {
          return { widthPx, heightPx };
        }
      }
      break;
    }

    offset += segmentLength;
  }

  return undefined;
}

function parseWebpDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 30) {
    return undefined;
  }
  if (buffer.toString("ascii", 0, 4) !== "RIFF") {
    return undefined;
  }
  if (buffer.toString("ascii", 8, 12) !== "WEBP") {
    return undefined;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (chunkType === "VP8X" && dataOffset + 10 <= buffer.length) {
      const widthMinusOne =
        buffer[dataOffset + 4] |
        (buffer[dataOffset + 5] << 8) |
        (buffer[dataOffset + 6] << 16);
      const heightMinusOne =
        buffer[dataOffset + 7] |
        (buffer[dataOffset + 8] << 8) |
        (buffer[dataOffset + 9] << 16);

      return {
        widthPx: widthMinusOne + 1,
        heightPx: heightMinusOne + 1,
      };
    }

    if (chunkType === "VP8 " && dataOffset + 10 <= buffer.length) {
      const hasStartCode =
        buffer[dataOffset + 3] === 0x9d &&
        buffer[dataOffset + 4] === 0x01 &&
        buffer[dataOffset + 5] === 0x2a;

      if (hasStartCode) {
        const widthPx = buffer.readUInt16LE(dataOffset + 6) & 0x3fff;
        const heightPx = buffer.readUInt16LE(dataOffset + 8) & 0x3fff;
        if (widthPx > 0 && heightPx > 0) {
          return { widthPx, heightPx };
        }
      }
    }

    if (chunkType === "VP8L" && dataOffset + 5 <= buffer.length) {
      if (buffer[dataOffset] === 0x2f) {
        const bits = buffer.readUInt32LE(dataOffset + 1);
        const widthPx = (bits & 0x3fff) + 1;
        const heightPx = ((bits >> 14) & 0x3fff) + 1;
        if (widthPx > 0 && heightPx > 0) {
          return { widthPx, heightPx };
        }
      }
    }

    const paddedChunkSize = chunkSize + (chunkSize % 2);
    const nextOffset = dataOffset + paddedChunkSize;
    if (nextOffset <= offset) {
      break;
    }
    offset = nextOffset;
  }

  return undefined;
}

function parseImageDimensions(buffer: Buffer): ImageDimensions | undefined {
  return (
    parsePngDimensions(buffer) ??
    parseJpegDimensions(buffer) ??
    parseWebpDimensions(buffer)
  );
}

async function readImageDimensions(absPath: string): Promise<ImageDimensions | undefined> {
  try {
    const bytes = await fs.readFile(absPath);
    return parseImageDimensions(bytes);
  } catch {
    return undefined;
  }
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
      const stat = await fs.stat(absPath);
      const dimensions = await readImageDimensions(absPath);

      return {
        filename: entry.name,
        absPath,
        mtimeMs: stat.mtimeMs,
        leadingNumber: parseLeadingNumber(entry.name),
        widthPx: dimensions?.widthPx,
        heightPx: dimensions?.heightPx,
      };
    }),
  );

  const sortedImages = imageCandidates
    .filter((candidate): candidate is RawImage => candidate !== null)
    .sort(compareImages);

  return sortedImages.map((image, index) => ({
    id: `image-${String(index + 1).padStart(3, "0")}`,
    filename: image.filename,
    absPath: image.absPath,
    publicPath: publicPathForFilename(image.filename),
    mtimeMs: image.mtimeMs,
    widthPx: image.widthPx,
    heightPx: image.heightPx,
  }));
}
