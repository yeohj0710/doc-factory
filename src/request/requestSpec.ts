import { stableHashFromParts } from "@/src/io/hash";
import { resolvePageSize, type PageSizePreset } from "@/src/layout/pageSize";
import type { DocType } from "@/src/layout/types";

export type RequestDocKind = "poster" | "brochure" | "onepager" | "report" | "cards";

export type RequestPageCount =
  | {
      mode: "exact";
      value: number;
    }
  | {
      mode: "range";
      min: number;
      max: number;
    };

export type RequestSpec = {
  jobId: string;
  prompt: string;
  docKind: RequestDocKind;
  pageCount: RequestPageCount;
  pageSize: {
    preset: PageSizePreset;
    widthMm: number;
    heightMm: number;
  };
  title: string;
  language: string;
  tone: string;
  constraints: string[];
  variantIndex: number;
  seed: number;
};

type RawInputReader = {
  get: (key: string) => string | undefined;
};

const DEFAULT_TITLE = "Visual_Document";
const DEFAULT_LANGUAGE = "ko";
const DEFAULT_TONE = "concise";
const DEFAULT_CONSTRAINTS = [
  "no-fabricated-numbers",
  "bullet-centric-copy",
  "trim-text-before-font-shrink",
];
const DEFAULT_PAGE_COUNT_BY_KIND: Record<RequestDocKind, RequestPageCount> = {
  poster: { mode: "exact", value: 1 },
  brochure: { mode: "range", min: 6, max: 10 },
  onepager: { mode: "exact", value: 2 },
  report: { mode: "range", min: 8, max: 14 },
  cards: { mode: "range", min: 4, max: 12 },
};

function readSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseDocKind(value: string | undefined): RequestDocKind | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["poster", "brochure", "onepager", "report", "cards"].includes(normalized)) {
    return normalized as RequestDocKind;
  }
  if (normalized === "one-pager") {
    return "onepager";
  }
  if (normalized === "onepager") {
    return "onepager";
  }
  return undefined;
}

function parseLegacyDocType(value: string | undefined): RequestDocKind | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "proposal") return "brochure";
  if (normalized === "poster") return "poster";
  if (normalized === "one-pager") return "onepager";
  if (normalized === "multi-card") return "cards";
  if (normalized === "report") return "report";
  return undefined;
}

function parsePageSizePreset(value: string | undefined): PageSizePreset | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  if (["A4P", "A4L", "LETTERP", "LETTERL", "CUSTOM"].includes(normalized)) {
    return normalized as PageSizePreset;
  }
  return undefined;
}

function parsePositiveIntFromText(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/(\d+)/);
  if (!match?.[1]) {
    return undefined;
  }
  const parsed = Number.parseInt(match[1], 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function parsePageCountSpec(raw: string | undefined): RequestPageCount | undefined {
  if (!raw) {
    return undefined;
  }

  const value = raw.trim().toLowerCase();
  const exactPatterns = [
    /^exact\s*[\(:]\s*(\d+)\s*\)?$/,
    /^(\d+)\s*(?:p|page|pages|장)?$/,
  ];

  for (const pattern of exactPatterns) {
    const match = value.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const exact = Number.parseInt(match[1], 10);
    if (!Number.isNaN(exact) && exact > 0) {
      return { mode: "exact", value: exact };
    }
  }

  const rangePatterns = [
    /^range\s*[\(:]\s*(\d+)\s*[,~-]\s*(\d+)\s*\)?$/,
    /^(\d+)\s*[-~]\s*(\d+)$/,
  ];
  for (const pattern of rangePatterns) {
    const match = value.match(pattern);
    if (!match?.[1] || !match?.[2]) {
      continue;
    }
    const min = Number.parseInt(match[1], 10);
    const max = Number.parseInt(match[2], 10);
    if (!Number.isNaN(min) && !Number.isNaN(max) && min > 0 && max > 0) {
      return normalizePageCount({
        mode: "range",
        min,
        max,
      });
    }
  }

  return undefined;
}

function normalizePageCount(pageCount: RequestPageCount): RequestPageCount {
  if (pageCount.mode === "exact") {
    return {
      mode: "exact",
      value: clampInt(pageCount.value, 1, 32),
    };
  }

  const min = clampInt(Math.min(pageCount.min, pageCount.max), 1, 32);
  const max = clampInt(Math.max(pageCount.min, pageCount.max), min, 32);
  return {
    mode: "range",
    min,
    max,
  };
}

function parseConstraints(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) {
    return [...DEFAULT_CONSTRAINTS];
  }

  const values = raw
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return [...DEFAULT_CONSTRAINTS];
  }

  return [...new Set(values)];
}

function normalizeTitle(raw: string | undefined): string {
  const candidate = raw?.trim();
  if (!candidate) {
    return DEFAULT_TITLE;
  }
  return candidate.slice(0, 120);
}

function seedFromRequest(parts: {
  jobId: string;
  prompt: string;
  docKind: RequestDocKind;
  title: string;
  variantIndex: number;
  pageCount: RequestPageCount;
  pageSizePreset: PageSizePreset;
  pageWidthMm: number;
  pageHeightMm: number;
}): number {
  const pageCountKey =
    parts.pageCount.mode === "exact"
      ? `exact:${parts.pageCount.value}`
      : `range:${parts.pageCount.min}-${parts.pageCount.max}`;
  const hash = stableHashFromParts(
    [
      parts.jobId,
      parts.prompt,
      parts.docKind,
      parts.title,
      String(parts.variantIndex),
      pageCountKey,
      parts.pageSizePreset,
      `${parts.pageWidthMm}x${parts.pageHeightMm}`,
    ],
    16,
  );
  return Number.parseInt(hash.slice(0, 8), 16) >>> 0;
}

function parsePrompt(input: RawInputReader): string {
  const prompt = input.get("prompt") ?? input.get("q") ?? "";
  return prompt.trim();
}

function parsePageCount(input: RawInputReader, docKind: RequestDocKind): RequestPageCount {
  const direct = parsePageCountSpec(input.get("pageCount") ?? input.get("pages"));
  if (direct) {
    return normalizePageCount(direct);
  }

  const rangeMin = parseInteger(input.get("pageCountMin") ?? input.get("minPages"));
  const rangeMax = parseInteger(input.get("pageCountMax") ?? input.get("maxPages"));
  if (typeof rangeMin === "number" && typeof rangeMax === "number") {
    return normalizePageCount({
      mode: "range",
      min: rangeMin,
      max: rangeMax,
    });
  }

  const promptCount = parsePositiveIntFromText(input.get("prompt") ?? input.get("q"));
  if (typeof promptCount === "number") {
    return normalizePageCount({
      mode: "exact",
      value: promptCount,
    });
  }

  return DEFAULT_PAGE_COUNT_BY_KIND[docKind];
}

function parsePageSize(input: RawInputReader): {
  preset: PageSizePreset;
  widthMm: number;
  heightMm: number;
} {
  const preset =
    parsePageSizePreset(input.get("pageSize") ?? input.get("size") ?? input.get("pageSizePreset")) ?? "A4P";
  const widthMm = parseNumber(input.get("pageWidthMm") ?? input.get("w"));
  const heightMm = parseNumber(input.get("pageHeightMm") ?? input.get("h"));

  const resolved = resolvePageSize({
    preset,
    widthMm,
    heightMm,
  });

  return {
    preset: resolved.preset,
    widthMm: resolved.widthMm,
    heightMm: resolved.heightMm,
  };
}

function makeInputReaderFromQuery(params: Record<string, string | string[] | undefined>): RawInputReader {
  return {
    get(key) {
      return readSingle(params[key]);
    },
  };
}

function makeInputReaderFromFormData(formData: FormData): RawInputReader {
  return {
    get(key) {
      const value = formData.get(key);
      if (typeof value !== "string") {
        return undefined;
      }
      return value;
    },
  };
}

function normalizeRequestSpec(input: RawInputReader): RequestSpec {
  const docKind =
    parseDocKind(input.get("docKind")) ??
    parseLegacyDocType(input.get("docType")) ??
    "brochure";

  const variantIndex = clampInt(parseInteger(input.get("variantIndex") ?? input.get("v")) ?? 1, 1, 999);
  const pageCount = parsePageCount(input, docKind);
  const pageSize = parsePageSize(input);
  const prompt = parsePrompt(input);
  const jobId = (input.get("jobId") ?? input.get("job") ?? `job-${variantIndex}`).trim() || `job-${variantIndex}`;
  const title = normalizeTitle(input.get("title") ?? input.get("docTitle"));
  const language = (input.get("language") ?? input.get("lang") ?? DEFAULT_LANGUAGE).trim() || DEFAULT_LANGUAGE;
  const tone = (input.get("tone") ?? DEFAULT_TONE).trim() || DEFAULT_TONE;
  const constraints = parseConstraints(input.get("constraints"));
  const parsedSeed = parseInteger(input.get("seed"));

  const seed =
    typeof parsedSeed === "number"
      ? parsedSeed >>> 0
      : seedFromRequest({
          jobId,
          prompt,
          docKind,
          title,
          variantIndex,
          pageCount,
          pageSizePreset: pageSize.preset,
          pageWidthMm: pageSize.widthMm,
          pageHeightMm: pageSize.heightMm,
        });

  return {
    jobId,
    prompt,
    docKind,
    pageCount,
    pageSize,
    title,
    language,
    tone,
    constraints,
    variantIndex,
    seed,
  };
}

export function normalizeRequestSpecFromQuery(
  params: Record<string, string | string[] | undefined>,
): RequestSpec {
  return normalizeRequestSpec(makeInputReaderFromQuery(params));
}

export function normalizeRequestSpecFromFormData(formData: FormData): RequestSpec {
  return normalizeRequestSpec(makeInputReaderFromFormData(formData));
}

export function mapRequestDocKindToDocType(docKind: RequestDocKind): DocType {
  if (docKind === "brochure") return "proposal";
  if (docKind === "onepager") return "one-pager";
  if (docKind === "cards") return "multi-card";
  return docKind;
}

export function mapDocTypeToRequestDocKind(docType: DocType): RequestDocKind {
  if (docType === "proposal") return "brochure";
  if (docType === "one-pager") return "onepager";
  if (docType === "multi-card") return "cards";
  return docType;
}

export function resolveRequestedPageCount(pageCount: RequestPageCount, fallback: number): number {
  if (pageCount.mode === "exact") {
    return pageCount.value;
  }
  if (fallback < pageCount.min) {
    return pageCount.min;
  }
  if (fallback > pageCount.max) {
    return pageCount.max;
  }
  return fallback;
}

export function requestPageCountLabel(pageCount: RequestPageCount): string {
  if (pageCount.mode === "exact") {
    return `exact(${pageCount.value})`;
  }
  return `range(${pageCount.min},${pageCount.max})`;
}

