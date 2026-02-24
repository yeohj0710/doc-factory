import { inflateSync } from "node:zlib";

export type ImageDimensions = {
  widthPx: number;
  heightPx: number;
};

export type DecodedBitmap = ImageDimensions & {
  pixelsRgba: Uint8Array;
};

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

export function parseImageDimensions(buffer: Buffer): ImageDimensions | undefined {
  return (
    parsePngDimensions(buffer) ??
    parseJpegDimensions(buffer) ??
    parseWebpDimensions(buffer)
  );
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
}

function bytesPerPixelForColorType(colorType: number): number | null {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 3) return 1;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  return null;
}

function applyPngFilter(
  filterType: number,
  row: Uint8Array,
  previousRow: Uint8Array,
  bytesPerPixel: number,
): Uint8Array | null {
  const current = new Uint8Array(row.length);

  if (filterType === 0) {
    current.set(row);
    return current;
  }

  for (let index = 0; index < row.length; index += 1) {
    const raw = row[index] ?? 0;
    const left = index >= bytesPerPixel ? current[index - bytesPerPixel] ?? 0 : 0;
    const up = previousRow[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previousRow[index - bytesPerPixel] ?? 0 : 0;

    let value: number;
    if (filterType === 1) {
      value = raw + left;
    } else if (filterType === 2) {
      value = raw + up;
    } else if (filterType === 3) {
      value = raw + Math.floor((left + up) / 2);
    } else if (filterType === 4) {
      value = raw + paethPredictor(left, up, upLeft);
    } else {
      return null;
    }

    current[index] = value & 0xff;
  }

  return current;
}

function signatureMatchesPng(buffer: Buffer): boolean {
  if (buffer.length < PNG_SIGNATURE.length) {
    return false;
  }

  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (buffer[index] !== PNG_SIGNATURE[index]) {
      return false;
    }
  }

  return true;
}

export function decodePngRgba(buffer: Buffer): DecodedBitmap | null {
  if (!signatureMatchesPng(buffer)) {
    return null;
  }

  let widthPx = 0;
  let heightPx = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const idatChunks: Buffer[] = [];
  let palette: Buffer | null = null;
  let paletteAlpha: Buffer | null = null;

  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    offset += 4;
    if (offset + 8 + chunkLength > buffer.length) {
      return null;
    }

    const chunkType = buffer.toString("ascii", offset, offset + 4);
    offset += 4;
    const chunkData = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    offset += 4;

    if (chunkType === "IHDR") {
      if (chunkData.length < 13) {
        return null;
      }
      widthPx = chunkData.readUInt32BE(0);
      heightPx = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8] ?? 0;
      colorType = chunkData[9] ?? 0;
      interlaceMethod = chunkData[12] ?? 0;
      continue;
    }

    if (chunkType === "PLTE") {
      palette = Buffer.from(chunkData);
      continue;
    }

    if (chunkType === "tRNS") {
      paletteAlpha = Buffer.from(chunkData);
      continue;
    }

    if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
      continue;
    }

    if (chunkType === "IEND") {
      break;
    }
  }

  if (widthPx <= 0 || heightPx <= 0 || idatChunks.length === 0) {
    return null;
  }
  if (bitDepth !== 8 || interlaceMethod !== 0) {
    return null;
  }

  const bytesPerPixel = bytesPerPixelForColorType(colorType);
  if (!bytesPerPixel) {
    return null;
  }

  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idatChunks));
  } catch {
    return null;
  }

  const stride = widthPx * bytesPerPixel;
  const required = (stride + 1) * heightPx;
  if (inflated.length < required) {
    return null;
  }

  const pixelsRgba = new Uint8Array(widthPx * heightPx * 4);
  let sourceOffset = 0;
  let previous = new Uint8Array(stride);

  for (let y = 0; y < heightPx; y += 1) {
    const filter = inflated[sourceOffset] ?? 0;
    sourceOffset += 1;
    const row = inflated.subarray(sourceOffset, sourceOffset + stride);
    sourceOffset += stride;

    const decoded = applyPngFilter(filter, row, previous, bytesPerPixel);
    if (!decoded) {
      return null;
    }

    const rowPixelOffset = y * widthPx * 4;

    for (let x = 0; x < widthPx; x += 1) {
      const target = rowPixelOffset + x * 4;
      if (colorType === 6) {
        const source = x * 4;
        pixelsRgba[target] = decoded[source] ?? 0;
        pixelsRgba[target + 1] = decoded[source + 1] ?? 0;
        pixelsRgba[target + 2] = decoded[source + 2] ?? 0;
        pixelsRgba[target + 3] = decoded[source + 3] ?? 255;
      } else if (colorType === 2) {
        const source = x * 3;
        pixelsRgba[target] = decoded[source] ?? 0;
        pixelsRgba[target + 1] = decoded[source + 1] ?? 0;
        pixelsRgba[target + 2] = decoded[source + 2] ?? 0;
        pixelsRgba[target + 3] = 255;
      } else if (colorType === 0) {
        const gray = decoded[x] ?? 0;
        pixelsRgba[target] = gray;
        pixelsRgba[target + 1] = gray;
        pixelsRgba[target + 2] = gray;
        pixelsRgba[target + 3] = 255;
      } else if (colorType === 4) {
        const source = x * 2;
        const gray = decoded[source] ?? 0;
        pixelsRgba[target] = gray;
        pixelsRgba[target + 1] = gray;
        pixelsRgba[target + 2] = gray;
        pixelsRgba[target + 3] = decoded[source + 1] ?? 255;
      } else if (colorType === 3) {
        const paletteIndex = decoded[x] ?? 0;
        const source = paletteIndex * 3;
        pixelsRgba[target] = palette?.[source] ?? 0;
        pixelsRgba[target + 1] = palette?.[source + 1] ?? 0;
        pixelsRgba[target + 2] = palette?.[source + 2] ?? 0;
        pixelsRgba[target + 3] = paletteAlpha?.[paletteIndex] ?? 255;
      }
    }

    previous = decoded;
  }

  return {
    widthPx,
    heightPx,
    pixelsRgba,
  };
}

