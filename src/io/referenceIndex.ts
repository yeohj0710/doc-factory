import { promises as fs } from "node:fs";
import path from "node:path";
import { decodePngRgba, parseImageDimensions, type DecodedBitmap } from "@/src/io/imageProbe";
import { sha256HexShort, stableHashFromParts } from "@/src/io/hash";
import { compareOrderedAssetPath, normalizeRelativePosixPath } from "@/src/io/ordering";

const REFERENCE_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const REFERENCE_INDEX_VERSION = 1;

export type ReferenceRhythm = "tight" | "balanced" | "airy";
export type ReferenceAccentRule = "muted" | "balanced" | "bold";
export type ReferenceIndexStatus = "not-required" | "fresh" | "stale" | "missing";

export type LayoutArchetype = {
  columns: number;
  heroRatio: number;
  cardDensity: number;
  headerRatio: number;
  footerRatio: number;
  rhythm: ReferenceRhythm;
};

export type StyleTokenHint = {
  typographyScale: number;
  spacingScale: number;
  radiusScale: number;
  strokeScale: number;
  shadowOpacity: number;
  accentRule: ReferenceAccentRule;
};

export type ReferenceEntryStyleFingerprint = {
  avgLuma: number;
  saturation: number;
  contrast: number;
  temperature: number;
  spacingDensity: number;
  radiusHint: "sharp" | "rounded";
  strokeHint: "light" | "strong";
  shadowHint: "none" | "soft";
};

export type ReferenceEntryLayoutFingerprint = {
  headerRatio: number;
  bodyRatio: number;
  footerRatio: number;
  columnGuess: number;
  heroRatio: number;
  cardDensity: number;
  rhythm: ReferenceRhythm;
  blockiness: number;
};

export type ReferenceIndexEntry = {
  id: string;
  relPath: string;
  widthPx: number;
  heightPx: number;
  aspect: number;
  palette: string[];
  density: number;
  whitespaceRatio: number;
  styleFingerprint: ReferenceEntryStyleFingerprint;
  layoutFingerprint: ReferenceEntryLayoutFingerprint;
  styleClusterId: string;
  layoutClusterId: string;
};

export type ReferenceStyleCluster = {
  id: string;
  key: string;
  size: number;
  medoidId: string;
  memberIds: string[];
  tokenHint: StyleTokenHint;
};

export type ReferenceLayoutCluster = {
  id: string;
  key: string;
  size: number;
  medoidId: string;
  memberIds: string[];
  archetype: LayoutArchetype;
};

export type ReferenceIndex = {
  version: number;
  referenceCount: number;
  structureDigest: string;
  fileIdDigest: string;
  referenceDigest: string;
  entries: ReferenceIndexEntry[];
  styleClusters: ReferenceStyleCluster[];
  layoutClusters: ReferenceLayoutCluster[];
};

export type ReferenceIndexContext = {
  required: boolean;
  referenceCount: number;
  status: ReferenceIndexStatus;
  index: ReferenceIndex | null;
  referenceDigest: string;
  staleReason?: string;
  rebuilt: boolean;
};

type ReferenceFile = {
  relPath: string;
  absPath: string;
  sizeBytes: number;
  mtimeMs: number;
};

type StyleClusterDraft = {
  key: string;
  entries: ReferenceIndexEntry[];
};

type LayoutClusterDraft = {
  key: string;
  entries: ReferenceIndexEntry[];
};

type RuntimeReferenceIndexCache = {
  rootDir: string;
  structureDigest: string;
  context: ReferenceIndexContext;
};

const GLOBAL_CACHE_KEY = "__docFactoryReferenceIndexCache__";

declare global {
  var __docFactoryReferenceIndexCache__: RuntimeReferenceIndexCache | undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFixedNumber(value: number, fractionDigits = 4): number {
  return Number(value.toFixed(fractionDigits));
}

function isReferenceImageFile(filename: string): boolean {
  return REFERENCE_IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function hexColor(r: number, g: number, b: number): string {
  const toHex = (value: number) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbSaturation(r: number, g: number, b: number): number {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  if (max === min) {
    return 0;
  }
  const lightness = (max + min) / 2;
  const denominator = 1 - Math.abs(2 * lightness - 1);
  if (denominator <= 0) {
    return 0;
  }
  return clamp((max - min) / denominator, 0, 1);
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function sectionIndexForY(y: number, height: number): 0 | 1 | 2 {
  if (height <= 0) {
    return 1;
  }
  const normalizedY = y / height;
  if (normalizedY < 0.2) {
    return 0;
  }
  if (normalizedY >= 0.82) {
    return 2;
  }
  return 1;
}

function rhythmFromStats(whitespaceRatio: number, blockiness: number): ReferenceRhythm {
  if (whitespaceRatio > 0.5) {
    return "airy";
  }
  if (whitespaceRatio < 0.24 || blockiness > 0.34) {
    return "tight";
  }
  return "balanced";
}

function styleKeyForEntry(entry: ReferenceIndexEntry): string {
  const style = entry.styleFingerprint;
  const lumaBin = Math.min(3, Math.floor(style.avgLuma * 4));
  const saturationBin = Math.min(3, Math.floor(style.saturation * 4));
  const densityBin = Math.min(3, Math.floor(style.spacingDensity * 4));
  const tempLabel = style.temperature > 0.2 ? "warm" : style.temperature < -0.2 ? "cool" : "neutral";
  const radiusLabel = style.radiusHint === "rounded" ? "round" : "sharp";
  return `${tempLabel}-${lumaBin}-${saturationBin}-${densityBin}-${radiusLabel}`;
}

function layoutKeyForEntry(entry: ReferenceIndexEntry): string {
  const layout = entry.layoutFingerprint;
  const heroBin = Math.min(3, Math.floor(layout.heroRatio * 4));
  const cardBin = Math.min(2, Math.floor(layout.cardDensity * 3));
  const headerBin = Math.min(2, Math.floor(layout.headerRatio * 3));
  return `${layout.columnGuess}-${heroBin}-${cardBin}-${layout.rhythm}-${headerBin}`;
}

function vectorDistance(a: readonly number[], b: readonly number[]): number {
  let total = 0;
  const size = Math.min(a.length, b.length);
  for (let index = 0; index < size; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    total += diff * diff;
  }
  return Math.sqrt(total);
}

function styleVector(entry: ReferenceIndexEntry): number[] {
  return [
    entry.styleFingerprint.avgLuma,
    entry.styleFingerprint.saturation,
    entry.styleFingerprint.contrast,
    entry.styleFingerprint.temperature,
    entry.styleFingerprint.spacingDensity,
    entry.layoutFingerprint.blockiness,
  ];
}

function layoutVector(entry: ReferenceIndexEntry): number[] {
  return [
    entry.layoutFingerprint.headerRatio,
    entry.layoutFingerprint.bodyRatio,
    entry.layoutFingerprint.footerRatio,
    entry.layoutFingerprint.columnGuess / 4,
    entry.layoutFingerprint.heroRatio,
    entry.layoutFingerprint.cardDensity,
    entry.layoutFingerprint.blockiness,
  ];
}

function averageVector(vectors: readonly number[][]): number[] {
  if (vectors.length === 0) {
    return [];
  }
  const total = vectors.reduce(
    (acc, vector) => {
      for (let index = 0; index < vector.length; index += 1) {
        acc[index] = (acc[index] ?? 0) + (vector[index] ?? 0);
      }
      return acc;
    },
    [] as number[],
  );

  return total.map((value) => value / vectors.length);
}

function chooseMedoid(entries: readonly ReferenceIndexEntry[], toVector: (entry: ReferenceIndexEntry) => number[]): string {
  if (entries.length === 0) {
    return "";
  }

  const centroid = averageVector(entries.map((entry) => toVector(entry)));
  const ordered = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  let best = ordered[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of ordered) {
    const distance = vectorDistance(toVector(candidate), centroid);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      continue;
    }
    if (distance === bestDistance && candidate.id < (best?.id ?? "")) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best?.id ?? "";
}

function styleTokenHintFromCluster(entries: readonly ReferenceIndexEntry[]): StyleTokenHint {
  const densityAvg = entries.reduce((sum, entry) => sum + entry.styleFingerprint.spacingDensity, 0) / Math.max(1, entries.length);
  const saturationAvg = entries.reduce((sum, entry) => sum + entry.styleFingerprint.saturation, 0) / Math.max(1, entries.length);
  const contrastAvg = entries.reduce((sum, entry) => sum + entry.styleFingerprint.contrast, 0) / Math.max(1, entries.length);
  const roundedRatio =
    entries.filter((entry) => entry.styleFingerprint.radiusHint === "rounded").length / Math.max(1, entries.length);
  const strongStrokeRatio =
    entries.filter((entry) => entry.styleFingerprint.strokeHint === "strong").length / Math.max(1, entries.length);
  const softShadowRatio =
    entries.filter((entry) => entry.styleFingerprint.shadowHint === "soft").length / Math.max(1, entries.length);

  const typographyScale = clamp(1 + (0.45 - densityAvg) * 0.18, 0.92, 1.08);
  const spacingScale = clamp(1 + (0.4 - densityAvg) * 0.65, 0.84, 1.2);
  const radiusScale = roundedRatio >= 0.5 ? 1.16 : 0.9;
  const strokeScale = strongStrokeRatio >= 0.5 ? 1.18 : 0.9;
  const shadowOpacity = clamp(0.05 + softShadowRatio * 0.08 + contrastAvg * 0.06, 0.04, 0.18);
  const accentRule: ReferenceAccentRule =
    saturationAvg > 0.5 ? "bold" : saturationAvg < 0.24 ? "muted" : "balanced";

  return {
    typographyScale: toFixedNumber(typographyScale, 4),
    spacingScale: toFixedNumber(spacingScale, 4),
    radiusScale: toFixedNumber(radiusScale, 4),
    strokeScale: toFixedNumber(strokeScale, 4),
    shadowOpacity: toFixedNumber(shadowOpacity, 4),
    accentRule,
  };
}

function majorityRhythm(entries: readonly ReferenceIndexEntry[]): ReferenceRhythm {
  const counts = new Map<ReferenceRhythm, number>();
  for (const entry of entries) {
    const rhythm = entry.layoutFingerprint.rhythm;
    counts.set(rhythm, (counts.get(rhythm) ?? 0) + 1);
  }

  const ordered: ReferenceRhythm[] = ["tight", "balanced", "airy"];
  ordered.sort((a, b) => {
    const countDiff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (countDiff !== 0) {
      return countDiff;
    }
    return a.localeCompare(b);
  });

  return ordered[0] ?? "balanced";
}

function layoutArchetypeFromCluster(entries: readonly ReferenceIndexEntry[]): LayoutArchetype {
  const safeLength = Math.max(1, entries.length);
  const average = entries.reduce(
    (acc, entry) => {
      acc.columns += entry.layoutFingerprint.columnGuess;
      acc.heroRatio += entry.layoutFingerprint.heroRatio;
      acc.cardDensity += entry.layoutFingerprint.cardDensity;
      acc.headerRatio += entry.layoutFingerprint.headerRatio;
      acc.footerRatio += entry.layoutFingerprint.footerRatio;
      return acc;
    },
    {
      columns: 0,
      heroRatio: 0,
      cardDensity: 0,
      headerRatio: 0,
      footerRatio: 0,
    },
  );

  return {
    columns: Math.round(clamp(average.columns / safeLength, 1, 4)),
    heroRatio: toFixedNumber(clamp(average.heroRatio / safeLength, 0.22, 0.78), 4),
    cardDensity: toFixedNumber(clamp(average.cardDensity / safeLength, 0.12, 0.92), 4),
    headerRatio: toFixedNumber(clamp(average.headerRatio / safeLength, 0.08, 0.24), 4),
    footerRatio: toFixedNumber(clamp(average.footerRatio / safeLength, 0.05, 0.18), 4),
    rhythm: majorityRhythm(entries),
  };
}

function buildStyleClusters(entries: ReferenceIndexEntry[]): {
  entries: ReferenceIndexEntry[];
  clusters: ReferenceStyleCluster[];
} {
  const grouped = new Map<string, ReferenceIndexEntry[]>();
  for (const entry of entries) {
    const key = styleKeyForEntry(entry);
    const bucket = grouped.get(key) ?? [];
    bucket.push(entry);
    grouped.set(key, bucket);
  }

  const drafts: StyleClusterDraft[] = [...grouped.entries()].map(([key, bucket]) => ({
    key,
    entries: [...bucket].sort((a, b) => a.id.localeCompare(b.id)),
  }));

  drafts.sort((a, b) => {
    const sizeDiff = b.entries.length - a.entries.length;
    if (sizeDiff !== 0) {
      return sizeDiff;
    }
    return a.key.localeCompare(b.key);
  });

  const clusterByKey = new Map<string, ReferenceStyleCluster>();
  const clusters: ReferenceStyleCluster[] = drafts.map((draft, index) => {
    const id = `style-c${String(index + 1).padStart(2, "0")}`;
    const cluster: ReferenceStyleCluster = {
      id,
      key: draft.key,
      size: draft.entries.length,
      medoidId: chooseMedoid(draft.entries, styleVector),
      memberIds: draft.entries.map((entry) => entry.id),
      tokenHint: styleTokenHintFromCluster(draft.entries),
    };
    clusterByKey.set(draft.key, cluster);
    return cluster;
  });

  const nextEntries = entries.map((entry) => {
    const cluster = clusterByKey.get(styleKeyForEntry(entry));
    return {
      ...entry,
      styleClusterId: cluster?.id ?? "style-c01",
    };
  });

  return {
    entries: nextEntries,
    clusters,
  };
}

function buildLayoutClusters(entries: ReferenceIndexEntry[]): {
  entries: ReferenceIndexEntry[];
  clusters: ReferenceLayoutCluster[];
} {
  const grouped = new Map<string, ReferenceIndexEntry[]>();
  for (const entry of entries) {
    const key = layoutKeyForEntry(entry);
    const bucket = grouped.get(key) ?? [];
    bucket.push(entry);
    grouped.set(key, bucket);
  }

  const drafts: LayoutClusterDraft[] = [...grouped.entries()].map(([key, bucket]) => ({
    key,
    entries: [...bucket].sort((a, b) => a.id.localeCompare(b.id)),
  }));

  drafts.sort((a, b) => {
    const sizeDiff = b.entries.length - a.entries.length;
    if (sizeDiff !== 0) {
      return sizeDiff;
    }
    return a.key.localeCompare(b.key);
  });

  const clusterByKey = new Map<string, ReferenceLayoutCluster>();
  const clusters: ReferenceLayoutCluster[] = drafts.map((draft, index) => {
    const id = `layout-c${String(index + 1).padStart(2, "0")}`;
    const cluster: ReferenceLayoutCluster = {
      id,
      key: draft.key,
      size: draft.entries.length,
      medoidId: chooseMedoid(draft.entries, layoutVector),
      memberIds: draft.entries.map((entry) => entry.id),
      archetype: layoutArchetypeFromCluster(draft.entries),
    };
    clusterByKey.set(draft.key, cluster);
    return cluster;
  });

  const nextEntries = entries.map((entry) => {
    const cluster = clusterByKey.get(layoutKeyForEntry(entry));
    return {
      ...entry,
      layoutClusterId: cluster?.id ?? "layout-c01",
    };
  });

  return {
    entries: nextEntries,
    clusters,
  };
}

function fallbackPaletteFromDigest(digest: string): string[] {
  const palette: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const offset = index * 6;
    const color = digest.slice(offset, offset + 6);
    palette.push(`#${color.padEnd(6, "0")}`);
  }
  return palette;
}

function fingerprintFromBitmap(bitmap: DecodedBitmap): {
  palette: string[];
  density: number;
  whitespaceRatio: number;
  styleFingerprint: ReferenceEntryStyleFingerprint;
  layoutFingerprint: ReferenceEntryLayoutFingerprint;
} {
  const width = Math.max(1, bitmap.widthPx);
  const height = Math.max(1, bitmap.heightPx);
  const pixels = bitmap.pixelsRgba;

  const totalPixels = width * height;
  const sampleStep = Math.max(1, Math.floor(Math.sqrt(totalPixels / 26000)));

  let sampledPixels = 0;
  let occupiedCount = 0;
  let lumaSum = 0;
  let lumaSquaredSum = 0;
  let saturationSum = 0;
  let temperatureSum = 0;

  const sectionTotals = [0, 0, 0];
  const sectionOccupied = [0, 0, 0];

  const xBinCount = 12;
  const xBinTotals = new Array<number>(xBinCount).fill(0);
  const xBinOccupied = new Array<number>(xBinCount).fill(0);

  const blockCols = 6;
  const blockRows = 6;
  const blockTotals = new Array<number>(blockCols * blockRows).fill(0);
  const blockOccupied = new Array<number>(blockCols * blockRows).fill(0);

  const colorCounts = new Map<number, number>();

  let edgeChecks = 0;
  let edgeTransitions = 0;
  let topHalfOccupied = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const pixelIndex = (y * width + x) * 4;
      const r = pixels[pixelIndex] ?? 0;
      const g = pixels[pixelIndex + 1] ?? 0;
      const b = pixels[pixelIndex + 2] ?? 0;
      const a = pixels[pixelIndex + 3] ?? 255;

      const luminance = luma(r, g, b);
      const isOccupied = a > 32 && luminance < 245;

      sampledPixels += 1;
      if (isOccupied) {
        occupiedCount += 1;
        if (y < height * 0.5) {
          topHalfOccupied += 1;
        }
      }

      lumaSum += luminance;
      lumaSquaredSum += luminance * luminance;
      saturationSum += rgbSaturation(r, g, b);
      temperatureSum += (r - b) / 255;

      const section = sectionIndexForY(y, height);
      sectionTotals[section] += 1;
      if (isOccupied) {
        sectionOccupied[section] += 1;
      }

      const xBin = Math.min(xBinCount - 1, Math.floor((x / width) * xBinCount));
      xBinTotals[xBin] += 1;
      if (isOccupied) {
        xBinOccupied[xBin] += 1;
      }

      const blockX = Math.min(blockCols - 1, Math.floor((x / width) * blockCols));
      const blockY = Math.min(blockRows - 1, Math.floor((y / height) * blockRows));
      const blockIndex = blockY * blockCols + blockX;
      blockTotals[blockIndex] += 1;
      if (isOccupied) {
        blockOccupied[blockIndex] += 1;
      }

      if (a > 32) {
        const qr = Math.floor(r / 32);
        const qg = Math.floor(g / 32);
        const qb = Math.floor(b / 32);
        const key = (qr << 10) | (qg << 5) | qb;
        colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
      }

      if (x + sampleStep < width) {
        const neighbor = (y * width + (x + sampleStep)) * 4;
        const nr = pixels[neighbor] ?? 0;
        const ng = pixels[neighbor + 1] ?? 0;
        const nb = pixels[neighbor + 2] ?? 0;
        const diff = Math.abs(luminance - luma(nr, ng, nb));
        edgeChecks += 1;
        if (diff >= 34) {
          edgeTransitions += 1;
        }
      }
    }
  }

  const safeSampledPixels = Math.max(1, sampledPixels);
  const density = occupiedCount / safeSampledPixels;
  const whitespaceRatio = 1 - density;
  const avgLuma = lumaSum / safeSampledPixels / 255;
  const avgSaturation = saturationSum / safeSampledPixels;
  const variance = Math.max(0, lumaSquaredSum / safeSampledPixels - (lumaSum / safeSampledPixels) ** 2);
  const contrast = Math.sqrt(variance) / 255;
  const temperature = clamp(temperatureSum / safeSampledPixels, -1, 1);
  const blockiness = edgeTransitions / Math.max(1, edgeChecks);

  const xBinRatios = xBinTotals.map((total, index) => {
    if (total <= 0) {
      return 0;
    }
    return xBinOccupied[index] / total;
  });

  let columnSegments = 0;
  let inSegment = false;
  for (const ratio of xBinRatios) {
    if (!inSegment && ratio > 0.22) {
      columnSegments += 1;
      inSegment = true;
      continue;
    }
    if (inSegment && ratio <= 0.12) {
      inSegment = false;
    }
  }
  const columnGuess = clamp(columnSegments || 1, 1, 4);

  const blockDensity = blockTotals.reduce((count, total, index) => {
    if (total <= 0) {
      return count;
    }
    const ratio = blockOccupied[index] / total;
    if (ratio > 0.42) {
      return count + 1;
    }
    return count;
  }, 0) / Math.max(1, blockTotals.length);

  const sortedColors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 6);

  const palette = sortedColors.map(([key]) => {
    const qr = (key >> 10) & 0x1f;
    const qg = (key >> 5) & 0x1f;
    const qb = key & 0x1f;
    return hexColor(qr * 8 + 4, qg * 8 + 4, qb * 8 + 4);
  });

  while (palette.length < 3) {
    const base = Math.round(avgLuma * 255);
    const offset = palette.length === 0 ? -26 : palette.length === 1 ? 0 : 26;
    const shade = clamp(base + offset, 0, 255);
    palette.push(hexColor(shade, shade, shade));
  }

  const headerRatio = sectionOccupied[0] / Math.max(1, sectionTotals[0]);
  const bodyRatio = sectionOccupied[1] / Math.max(1, sectionTotals[1]);
  const footerRatio = sectionOccupied[2] / Math.max(1, sectionTotals[2]);
  const heroRatio = topHalfOccupied / Math.max(1, occupiedCount);

  return {
    palette: palette.slice(0, 6),
    density: toFixedNumber(clamp(density, 0, 1), 4),
    whitespaceRatio: toFixedNumber(clamp(whitespaceRatio, 0, 1), 4),
    styleFingerprint: {
      avgLuma: toFixedNumber(clamp(avgLuma, 0, 1), 4),
      saturation: toFixedNumber(clamp(avgSaturation, 0, 1), 4),
      contrast: toFixedNumber(clamp(contrast, 0, 1), 4),
      temperature: toFixedNumber(temperature, 4),
      spacingDensity: toFixedNumber(clamp(density, 0, 1), 4),
      radiusHint: blockiness < 0.22 ? "rounded" : "sharp",
      strokeHint: contrast > 0.26 || blockiness > 0.3 ? "strong" : "light",
      shadowHint: contrast > 0.18 && density > 0.35 ? "soft" : "none",
    },
    layoutFingerprint: {
      headerRatio: toFixedNumber(clamp(headerRatio, 0, 1), 4),
      bodyRatio: toFixedNumber(clamp(bodyRatio, 0, 1), 4),
      footerRatio: toFixedNumber(clamp(footerRatio, 0, 1), 4),
      columnGuess,
      heroRatio: toFixedNumber(clamp(heroRatio, 0, 1), 4),
      cardDensity: toFixedNumber(clamp(blockDensity, 0, 1), 4),
      rhythm: rhythmFromStats(whitespaceRatio, blockiness),
      blockiness: toFixedNumber(clamp(blockiness, 0, 1), 4),
    },
  };
}

function fingerprintFromFallback(bytes: Buffer, widthPx: number, heightPx: number): {
  palette: string[];
  density: number;
  whitespaceRatio: number;
  styleFingerprint: ReferenceEntryStyleFingerprint;
  layoutFingerprint: ReferenceEntryLayoutFingerprint;
} {
  const digest = sha256HexShort(bytes, 24);
  const palette = fallbackPaletteFromDigest(digest);
  const seedA = Number.parseInt(digest.slice(0, 4), 16);
  const seedB = Number.parseInt(digest.slice(4, 8), 16);
  const seedC = Number.parseInt(digest.slice(8, 12), 16);
  const density = clamp(((seedA % 450) + 250) / 1000, 0.2, 0.72);
  const whitespaceRatio = 1 - density;
  const aspect = widthPx > 0 && heightPx > 0 ? widthPx / heightPx : 1;
  const columnGuess = aspect > 1.25 ? 2 : 1;
  const heroRatio = clamp(((seedB % 700) + 150) / 1000, 0.18, 0.8);
  const cardDensity = clamp(((seedC % 650) + 100) / 1000, 0.1, 0.82);
  const blockiness = clamp(((seedA + seedB) % 1000) / 1000, 0.08, 0.74);
  const rhythm = rhythmFromStats(whitespaceRatio, blockiness);

  return {
    palette,
    density: toFixedNumber(density, 4),
    whitespaceRatio: toFixedNumber(whitespaceRatio, 4),
    styleFingerprint: {
      avgLuma: toFixedNumber(((seedA % 700) + 150) / 1000, 4),
      saturation: toFixedNumber(((seedB % 600) + 120) / 1000, 4),
      contrast: toFixedNumber(((seedC % 500) + 120) / 1000, 4),
      temperature: toFixedNumber((((seedA % 200) - 100) / 100), 4),
      spacingDensity: toFixedNumber(density, 4),
      radiusHint: blockiness < 0.34 ? "rounded" : "sharp",
      strokeHint: blockiness > 0.4 ? "strong" : "light",
      shadowHint: density > 0.4 ? "soft" : "none",
    },
    layoutFingerprint: {
      headerRatio: toFixedNumber(0.16, 4),
      bodyRatio: toFixedNumber(0.68, 4),
      footerRatio: toFixedNumber(0.16, 4),
      columnGuess,
      heroRatio: toFixedNumber(heroRatio, 4),
      cardDensity: toFixedNumber(cardDensity, 4),
      rhythm,
      blockiness: toFixedNumber(blockiness, 4),
    },
  };
}

function entryFingerprintSignature(entry: ReferenceIndexEntry): string {
  const layout = entry.layoutFingerprint;
  return [
    entry.id,
    entry.styleClusterId,
    entry.layoutClusterId,
    entry.palette.join(","),
    entry.density.toFixed(4),
    entry.whitespaceRatio.toFixed(4),
    layout.columnGuess,
    layout.heroRatio.toFixed(4),
    layout.cardDensity.toFixed(4),
    layout.headerRatio.toFixed(4),
    layout.bodyRatio.toFixed(4),
    layout.footerRatio.toFixed(4),
    layout.rhythm,
  ].join(":");
}

function styleClusterSignature(cluster: ReferenceStyleCluster): string {
  const hint = cluster.tokenHint;
  return [
    cluster.id,
    cluster.medoidId,
    cluster.memberIds.join(","),
    hint.typographyScale.toFixed(4),
    hint.spacingScale.toFixed(4),
    hint.radiusScale.toFixed(4),
    hint.strokeScale.toFixed(4),
    hint.shadowOpacity.toFixed(4),
    hint.accentRule,
  ].join(":");
}

function layoutClusterSignature(cluster: ReferenceLayoutCluster): string {
  const archetype = cluster.archetype;
  return [
    cluster.id,
    cluster.medoidId,
    cluster.memberIds.join(","),
    archetype.columns,
    archetype.heroRatio.toFixed(4),
    archetype.cardDensity.toFixed(4),
    archetype.headerRatio.toFixed(4),
    archetype.footerRatio.toFixed(4),
    archetype.rhythm,
  ].join(":");
}

function computeStructureDigest(files: readonly ReferenceFile[]): string {
  return stableHashFromParts(
    files.map((file) => `${file.relPath}:${file.sizeBytes}:${Math.round(file.mtimeMs)}`),
    24,
  );
}

async function listReferenceFiles(rootDir: string): Promise<ReferenceFile[]> {
  const referencesDir = path.join(rootDir, "references");
  const sink: ReferenceFile[] = [];

  const walk = async (currentDir: string): Promise<void> => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return;
      }
      throw error;
    }

    entries.sort((a, b) => compareOrderedAssetPath(a.name, b.name));

    for (const entry of entries) {
      const absPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absPath);
        continue;
      }
      if (!entry.isFile() || !isReferenceImageFile(entry.name)) {
        continue;
      }

      const stat = await fs.stat(absPath);
      const relPath = normalizeRelativePosixPath(path.relative(referencesDir, absPath));
      sink.push({
        relPath,
        absPath,
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
      });
    }
  };

  await walk(referencesDir);
  sink.sort((a, b) => compareOrderedAssetPath(a.relPath, b.relPath));
  return sink;
}

async function readReferenceIndexFile(rootDir: string): Promise<ReferenceIndex | null> {
  const indexPath = path.join(rootDir, "src", "generated", "reference-index.json");

  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ReferenceIndex>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (parsed.version !== REFERENCE_INDEX_VERSION) {
      return null;
    }
    if (!Array.isArray(parsed.entries) || !Array.isArray(parsed.styleClusters) || !Array.isArray(parsed.layoutClusters)) {
      return null;
    }
    if (typeof parsed.structureDigest !== "string" || typeof parsed.fileIdDigest !== "string" || typeof parsed.referenceDigest !== "string") {
      return null;
    }
    if (typeof parsed.referenceCount !== "number") {
      return null;
    }
    return parsed as ReferenceIndex;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }
    return null;
  }
}

async function writeReferenceIndexFile(rootDir: string, index: ReferenceIndex): Promise<void> {
  const targetDir = path.join(rootDir, "src", "generated");
  const targetFile = path.join(targetDir, "reference-index.json");
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

async function computeFileIds(files: readonly ReferenceFile[]): Promise<{
  idsByRelPath: Map<string, string>;
  fileIdDigest: string;
}> {
  const idsByRelPath = new Map<string, string>();
  const sortedIds: string[] = [];

  for (const file of files) {
    const bytes = await fs.readFile(file.absPath);
    const id = sha256HexShort(bytes, 12);
    idsByRelPath.set(file.relPath, id);
    sortedIds.push(id);
  }

  sortedIds.sort((a, b) => a.localeCompare(b));
  const fileIdDigest = stableHashFromParts(sortedIds, 24);

  return {
    idsByRelPath,
    fileIdDigest,
  };
}

async function buildReferenceIndex(files: readonly ReferenceFile[]): Promise<ReferenceIndex> {
  const entries: ReferenceIndexEntry[] = [];
  const fileIds = await computeFileIds(files);

  for (const file of files) {
    const bytes = await fs.readFile(file.absPath);
    const dimensions = parseImageDimensions(bytes);
    const widthPx = dimensions?.widthPx ?? 1;
    const heightPx = dimensions?.heightPx ?? 1;
    const aspect = widthPx > 0 && heightPx > 0 ? widthPx / heightPx : 1;
    const bitmap = decodePngRgba(bytes);
    const fingerprint = bitmap ? fingerprintFromBitmap(bitmap) : fingerprintFromFallback(bytes, widthPx, heightPx);

    entries.push({
      id: fileIds.idsByRelPath.get(file.relPath) ?? sha256HexShort(bytes, 12),
      relPath: file.relPath,
      widthPx,
      heightPx,
      aspect: toFixedNumber(aspect, 6),
      palette: fingerprint.palette.slice(0, 6),
      density: fingerprint.density,
      whitespaceRatio: fingerprint.whitespaceRatio,
      styleFingerprint: fingerprint.styleFingerprint,
      layoutFingerprint: fingerprint.layoutFingerprint,
      styleClusterId: "",
      layoutClusterId: "",
    });
  }

  entries.sort((a, b) => a.id.localeCompare(b.id) || compareOrderedAssetPath(a.relPath, b.relPath));

  const withStyleClusters = buildStyleClusters(entries);
  const withLayoutClusters = buildLayoutClusters(withStyleClusters.entries);

  const structureDigest = computeStructureDigest(files);
  const fileIdDigest = fileIds.fileIdDigest;
  const entrySignatures = withLayoutClusters.entries
    .map(entryFingerprintSignature)
    .sort((a, b) => a.localeCompare(b));
  const styleSignatures = withStyleClusters.clusters.map(styleClusterSignature);
  const layoutSignatures = withLayoutClusters.clusters.map(layoutClusterSignature);
  const referenceDigest = stableHashFromParts(
    [...entrySignatures, ...styleSignatures, ...layoutSignatures],
    32,
  );

  return {
    version: REFERENCE_INDEX_VERSION,
    referenceCount: withLayoutClusters.entries.length,
    structureDigest,
    fileIdDigest,
    referenceDigest,
    entries: withLayoutClusters.entries,
    styleClusters: withStyleClusters.clusters,
    layoutClusters: withLayoutClusters.clusters,
  };
}

function getRuntimeCache(): RuntimeReferenceIndexCache | null {
  return globalThis[GLOBAL_CACHE_KEY] ?? null;
}

function setRuntimeCache(cache: RuntimeReferenceIndexCache): void {
  globalThis[GLOBAL_CACHE_KEY] = cache;
}

function clearRuntimeCache(): void {
  globalThis[GLOBAL_CACHE_KEY] = undefined;
}

function sortClusterMemberIds(index: ReferenceIndex, memberIds: readonly string[]): string[] {
  const byId = new Map(index.entries.map((entry) => [entry.id, entry] as const));
  return [...memberIds].sort((left, right) => {
    const leftEntry = byId.get(left);
    const rightEntry = byId.get(right);
    if (!leftEntry || !rightEntry) {
      return left.localeCompare(right);
    }
    return compareOrderedAssetPath(leftEntry.relPath, rightEntry.relPath) || left.localeCompare(right);
  });
}

function representativeIdsByClusters(params: {
  index: ReferenceIndex;
  clusterKind: "style" | "layout";
  minCount?: number;
  maxCount?: number;
}): string[] {
  const minCount = params.minCount ?? 8;
  const maxCount = params.maxCount ?? 16;
  const clusters =
    params.clusterKind === "style"
      ? params.index.styleClusters
      : params.index.layoutClusters;
  const sortedClusters = [...clusters].sort((a, b) => {
    const sizeDiff = b.size - a.size;
    if (sizeDiff !== 0) {
      return sizeDiff;
    }
    return a.id.localeCompare(b.id);
  });

  const target = clamp(Math.max(minCount, sortedClusters.length), 1, Math.min(maxCount, params.index.referenceCount));
  const selected: string[] = [];
  const seen = new Set<string>();

  for (const cluster of sortedClusters) {
    if (!seen.has(cluster.medoidId)) {
      selected.push(cluster.medoidId);
      seen.add(cluster.medoidId);
    }
  }

  while (selected.length < target) {
    let appended = false;
    for (const cluster of sortedClusters) {
      const members = sortClusterMemberIds(params.index, cluster.memberIds);
      const candidate = members.find((id) => !seen.has(id));
      if (!candidate) {
        continue;
      }
      selected.push(candidate);
      seen.add(candidate);
      appended = true;
      if (selected.length >= target) {
        break;
      }
    }
    if (!appended) {
      break;
    }
  }

  return selected.slice(0, target);
}

export function pickRepresentativeStyleReferenceIds(index: ReferenceIndex, minCount = 8, maxCount = 16): string[] {
  return representativeIdsByClusters({
    index,
    clusterKind: "style",
    minCount,
    maxCount,
  });
}

export function pickRepresentativeLayoutReferenceIds(index: ReferenceIndex, minCount = 8, maxCount = 16): string[] {
  return representativeIdsByClusters({
    index,
    clusterKind: "layout",
    minCount,
    maxCount,
  });
}

export async function ensureReferenceIndex(params: {
  rootDir?: string;
  allowRebuild: boolean;
  minRequiredCount?: number;
}): Promise<ReferenceIndexContext> {
  const rootDir = params.rootDir ?? process.cwd();
  const minRequiredCount = params.minRequiredCount ?? 8;
  const files = await listReferenceFiles(rootDir);
  const structureDigest = computeStructureDigest(files);

  const cache = getRuntimeCache();
  if (cache && cache.rootDir === rootDir && cache.structureDigest === structureDigest) {
    return cache.context;
  }

  if (files.length < minRequiredCount) {
    const context: ReferenceIndexContext = {
      required: false,
      referenceCount: files.length,
      status: "not-required",
      index: null,
      referenceDigest: "",
      rebuilt: false,
    };
    setRuntimeCache({
      rootDir,
      structureDigest,
      context,
    });
    return context;
  }

  const existing = await readReferenceIndexFile(rootDir);
  if (
    existing &&
    existing.referenceCount === files.length &&
    existing.structureDigest === structureDigest
  ) {
    const context: ReferenceIndexContext = {
      required: true,
      referenceCount: files.length,
      status: "fresh",
      index: existing,
      referenceDigest: existing.referenceDigest,
      rebuilt: false,
    };
    setRuntimeCache({
      rootDir,
      structureDigest,
      context,
    });
    return context;
  }

  const currentIds = await computeFileIds(files);
  const staleReason = existing
    ? existing.fileIdDigest === currentIds.fileIdDigest
      ? "reference structure changed"
      : "reference file digest changed"
    : "reference index missing";

  if (!params.allowRebuild) {
    clearRuntimeCache();
    return {
      required: true,
      referenceCount: files.length,
      status: existing ? "stale" : "missing",
      index: existing,
      referenceDigest: existing?.referenceDigest ?? "",
      staleReason,
      rebuilt: false,
    };
  }

  const rebuilt = await buildReferenceIndex(files);
  await writeReferenceIndexFile(rootDir, rebuilt);

  const context: ReferenceIndexContext = {
    required: true,
    referenceCount: files.length,
    status: "fresh",
    index: rebuilt,
    referenceDigest: rebuilt.referenceDigest,
    rebuilt: true,
  };

  setRuntimeCache({
    rootDir,
    structureDigest: rebuilt.structureDigest,
    context,
  });

  return context;
}
