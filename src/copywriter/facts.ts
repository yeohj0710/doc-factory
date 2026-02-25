import path from "node:path";
import type { CopyDeck, CopyDeckPage, CopyFacts, CopyFactsPage, CopySlot, CopywriterBuildInput } from "@/src/copywriter/types";

function sanitizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitSentences(value: string): string[] {
  return value
    .split(/[\n.!?]+/g)
    .map((line) => sanitizeLine(line))
    .filter(Boolean);
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function filenameHint(filename: string | null): string {
  if (!filename) {
    return "visual reference";
  }

  const stem = path.parse(filename).name;
  const cleaned = stem
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "visual reference";
}

function imageHintByFilename(filenames: string[]): string[] {
  return dedupePreserveOrder(filenames.map((filename) => filenameHint(filename))).slice(0, 8);
}

function pageSlotsByDocKind(docKind: CopyFacts["docKind"]): {
  minBlocks: number;
  minChars: number;
  minBodyFontPt: number;
} {
  if (docKind === "poster_set") {
    return {
      minBlocks: 4,
      minChars: 220,
      minBodyFontPt: 16,
    };
  }

  if (docKind === "onepager") {
    return {
      minBlocks: 4,
      minChars: 180,
      minBodyFontPt: 12,
    };
  }

  if (docKind === "poster") {
    return {
      minBlocks: 3,
      minChars: 120,
      minBodyFontPt: 14,
    };
  }

  return {
    minBlocks: 3,
    minChars: 120,
    minBodyFontPt: 12,
  };
}

export function buildCopyFacts(input: CopywriterBuildInput): CopyFacts {
  const sourceLines = splitSentences([input.plan.requestSpec.contentBrief, input.plan.requestSpec.prompt].filter(Boolean).join("\n"));
  const imageHints = imageHintByFilename(input.orderedImages.map((image) => image.filename));
  const sharedHints = dedupePreserveOrder([
    ...sourceLines,
    input.plan.docTitle,
    ...imageHints,
    "Facts not provided must stay as (추후 기입).",
    "Keep the tone concise and actionable.",
  ]).slice(0, 16);

  const pages: CopyFactsPage[] = input.storyboard.map((item) => ({
    pageIndex: item.pageNumber,
    role: item.role,
    topicLabel: item.topicLabel,
    imageFilename: item.primaryAssetFilename,
    imageHint: filenameHint(item.primaryAssetFilename),
    successCriteria: item.successCriteria,
  }));

  return {
    requestHash: input.requestHash,
    docKind: input.plan.requestSpec.docKind,
    language: input.plan.requestSpec.language,
    tone: input.plan.requestSpec.tone,
    title: input.plan.docTitle,
    prompt: input.plan.requestSpec.prompt,
    contentBrief: input.plan.requestSpec.contentBrief ?? "",
    sharedHints,
    pages,
  };
}

export function buildCopySlots(facts: CopyFacts): CopySlot[] {
  const threshold = pageSlotsByDocKind(facts.docKind);
  return facts.pages.map((page) => ({
    pageIndex: page.pageIndex,
    role: page.role,
    minBlocks: threshold.minBlocks,
    minChars: threshold.minChars,
    minBodyFontPt: threshold.minBodyFontPt,
  }));
}

export function normalizeCopyDeckPage(page: CopyDeckPage): CopyDeckPage {
  const normalizedBlocks: CopyDeckPage["blocks"] = [];
  for (const block of page.blocks) {
    const text = typeof block.text === "string" ? sanitizeLine(block.text) : undefined;
    const items = Array.isArray(block.items)
      ? block.items.map((item) => sanitizeLine(String(item))).filter(Boolean)
      : undefined;

    if (!text && (!items || items.length === 0)) {
      continue;
    }

    normalizedBlocks.push({
      ...block,
      ...(text ? { text } : {}),
      ...(items && items.length > 0 ? { items } : {}),
    });
  }

  return {
    ...page,
    blocks: normalizedBlocks,
  };
}

function blockTextLength(block: CopyDeckPage["blocks"][number]): number {
  const textLength = block.text ? sanitizeLine(block.text).length : 0;
  const itemLength = Array.isArray(block.items)
    ? block.items.reduce((sum, item) => sum + sanitizeLine(item).length, 0)
    : 0;
  return textLength + itemLength;
}

export function copyDeckPageStats(page: CopyDeckPage): {
  textChars: number;
  textBlocks: number;
} {
  let textChars = 0;
  let textBlocks = 0;

  for (const block of page.blocks) {
    const blockChars = blockTextLength(block);
    if (blockChars <= 0) {
      continue;
    }
    textBlocks += 1;
    textChars += blockChars;
  }

  return {
    textChars,
    textBlocks,
  };
}

function ensureRequiredKinds(page: CopyDeckPage): CopyDeckPage {
  const hasHeadline = page.blocks.some((block) => block.kind === "headline" && (block.text ?? "").length > 0);
  const hasSubhead = page.blocks.some((block) => block.kind === "subhead" && (block.text ?? "").length > 0);
  const hasParagraph = page.blocks.some((block) => block.kind === "paragraph" && (block.text ?? "").length > 0);
  const hasBullets = page.blocks.some((block) => block.kind === "bullets" && (block.items?.length ?? 0) > 0);
  const hasCallout = page.blocks.some((block) => block.kind === "callout" && (block.text ?? "").length > 0);

  const blocks = [...page.blocks];

  if (!hasHeadline) {
    blocks.unshift({
      kind: "headline",
      text: "[제목]",
      constraints: { targetChars: 20, intent: "informative" },
    });
  }

  if (!hasSubhead) {
    blocks.push({
      kind: "subhead",
      text: "핵심 요약은 (추후 기입)",
      constraints: { targetChars: 32, intent: "informative" },
    });
  }

  if (!hasParagraph) {
    blocks.push({
      kind: "paragraph",
      text: "근거/수치/회사명/연락처 등 확정 정보는 (추후 기입)으로 남깁니다.",
      constraints: { targetChars: 70, intent: "informative" },
    });
  }

  if (!hasBullets) {
    blocks.push({
      kind: "bullets",
      items: ["핵심 포인트 (추후 기입)", "차별점 (추후 기입)", "실행 항목 (추후 기입)"],
      constraints: { targetChars: 60, intent: "informative" },
    });
  }

  if (!hasCallout) {
    blocks.push({
      kind: "callout",
      text: "연락/링크: (추후 기입)",
      constraints: { targetChars: 24, intent: "cta" },
    });
  }

  return {
    ...page,
    blocks,
  };
}

function expandToMinBlocks(page: CopyDeckPage, minBlocks: number): CopyDeckPage {
  const blocks = [...page.blocks];
  while (blocks.length < minBlocks) {
    blocks.push({
      kind: "paragraph",
      text: "설명이 필요한 정보는 추후 확인 후 업데이트합니다.",
      constraints: { targetChars: 32, intent: "informative" },
    });
  }

  return {
    ...page,
    blocks,
  };
}

function expandToMinChars(page: CopyDeckPage, minChars: number): CopyDeckPage {
  const blocks = [...page.blocks];
  const growthSentences = [
    "사실 확인이 필요한 값은 (추후 기입)으로 남기고, 현재 확보된 정보만 우선 전달합니다.",
    "이 페이지는 독자가 다음 행동을 바로 정할 수 있도록 핵심 근거와 실천 항목을 함께 보여줍니다.",
    "문구는 간결하게 유지하되 정보 밀도는 유지하도록 블록을 분리해 배치합니다.",
  ];

  let cursor = 0;
  let chars = copyDeckPageStats({ ...page, blocks }).textChars;

  while (chars < minChars) {
    blocks.push({
      kind: "paragraph",
      text: growthSentences[cursor % growthSentences.length],
      constraints: { targetChars: 58, intent: "informative" },
    });
    cursor += 1;
    chars = copyDeckPageStats({ ...page, blocks }).textChars;
  }

  return {
    ...page,
    blocks,
  };
}

export function enforceCopyDeckDensity(deck: CopyDeck, slots: CopySlot[]): CopyDeck {
  const slotByPageIndex = new Map(slots.map((slot) => [slot.pageIndex, slot] as const));

  const pages = deck.pages.map((page) => {
    const slot = slotByPageIndex.get(page.pageIndex);
    const normalized = normalizeCopyDeckPage(page);
    const required = ensureRequiredKinds(normalized);

    if (!slot) {
      return required;
    }

    const expandedBlocks = expandToMinBlocks(required, slot.minBlocks);
    const expandedChars = expandToMinChars(expandedBlocks, slot.minChars);

    return expandedChars;
  });

  return {
    ...deck,
    pages,
  };
}
