import { stableHashFromParts } from "@/src/io/hash";
import { resolvePageSize, type PageSizePreset } from "@/src/layout/pageSize";
import type { DocType } from "@/src/layout/types";

export type RequestDocKind = "poster" | "poster_set" | "brochure" | "onepager" | "report" | "cards";

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
  contentBrief?: string;
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
  poster_set: { mode: "range", min: 2, max: 4 },
  brochure: { mode: "range", min: 6, max: 12 },
  onepager: { mode: "exact", value: 1 },
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
  if (["poster", "poster_set", "brochure", "onepager", "report", "cards"].includes(normalized)) {
    return normalized as RequestDocKind;
  }
  if (normalized === "poster-set" || normalized === "posterset" || normalized === "poster set") {
    return "poster_set";
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

function parsePromptPageCount(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const patterns = [
    /(\d+)\s*(?:장|페이지)/iu,
    /\b(\d+)\s*(?:page|pages|p)\b/iu,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function inferDocKindFromPrompt(prompt: string): RequestDocKind | undefined {
  const normalized = prompt.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const hasPosterSignal = /(?:포스터|poster)/iu.test(normalized);
  if (hasPosterSignal) {
    const explicitCount = parsePromptPageCount(normalized);
    const setSignal = /(?:세트|셋|시리즈|series|set)/iu.test(normalized);
    if ((typeof explicitCount === "number" && explicitCount >= 2) || setSignal) {
      return "poster_set";
    }
    return "poster";
  }

  if (/(?:원페이지|원 페이저|onepager|one-pager)/iu.test(normalized)) {
    return "onepager";
  }
  if (/(?:보고서|리포트|report)/iu.test(normalized)) {
    return "report";
  }
  if (/(?:카드|cards?)/iu.test(normalized)) {
    return "cards";
  }
  if (/(?:브로슈어|소개서|brochure|proposal)/iu.test(normalized)) {
    return "brochure";
  }

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
  contentBrief?: string;
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
      parts.contentBrief ?? "",
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

function parsePageCount(input: RawInputReader, docKind: RequestDocKind, prompt: string): RequestPageCount {
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

  const promptCount = parsePromptPageCount(prompt);
  if (typeof promptCount === "number") {
    return normalizePageCount({
      mode: "exact",
      value: promptCount,
    });
  }

  return DEFAULT_PAGE_COUNT_BY_KIND[docKind];
}

function parseContentBrief(input: RawInputReader, prompt: string): string | undefined {
  const raw = input.get("contentBrief") ?? input.get("brief") ?? input.get("content");
  const normalized = raw?.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized === prompt) {
    return normalized.slice(0, 4000);
  }
  return normalized.slice(0, 4000);
}

function normalizePosterSetPageCount(pageCount: RequestPageCount): RequestPageCount {
  if (pageCount.mode === "exact") {
    return {
      mode: "exact",
      value: clampInt(Math.max(2, pageCount.value), 2, 32),
    };
  }

  return normalizePageCount({
    mode: "range",
    min: Math.max(2, pageCount.min),
    max: Math.max(2, pageCount.max),
  });
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
  const prompt = parsePrompt(input);
  const explicitDocKind =
    parseDocKind(input.get("docKind")) ??
    parseLegacyDocType(input.get("docType")) ??
    inferDocKindFromPrompt(prompt);
  let docKind = explicitDocKind ?? "brochure";

  const variantIndex = clampInt(parseInteger(input.get("variantIndex") ?? input.get("v")) ?? 1, 1, 999);
  let pageCount = parsePageCount(input, docKind, prompt);
  const pageSize = parsePageSize(input);
  const contentBrief = parseContentBrief(input, prompt);
  const jobId = (input.get("jobId") ?? input.get("job") ?? `job-${variantIndex}`).trim() || `job-${variantIndex}`;
  const title = normalizeTitle(input.get("title") ?? input.get("docTitle"));
  const language = (input.get("language") ?? input.get("lang") ?? DEFAULT_LANGUAGE).trim() || DEFAULT_LANGUAGE;
  const tone = (input.get("tone") ?? DEFAULT_TONE).trim() || DEFAULT_TONE;
  const constraints = parseConstraints(input.get("constraints"));
  const parsedSeed = parseInteger(input.get("seed"));

  if (docKind === "poster" && pageCount.mode === "exact" && pageCount.value >= 2) {
    docKind = "poster_set";
  }
  if (docKind === "poster" && pageCount.mode === "range" && pageCount.max >= 2) {
    docKind = "poster_set";
  }
  if (docKind === "poster_set") {
    pageCount = normalizePosterSetPageCount(pageCount);
  }

  const seed =
    typeof parsedSeed === "number"
      ? parsedSeed >>> 0
      : seedFromRequest({
          jobId,
          prompt,
          contentBrief,
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
    contentBrief,
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
  if (docKind === "poster_set") return "poster";
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

