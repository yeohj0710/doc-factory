import path from "node:path";
import type { CopyDeckBlock, CopyDeckPage } from "@/src/copywriter/types";
import { getTemplateSpec, type TemplateId, type TextBudget } from "@/src/layout/templateCatalog";
import type { LayoutTokens } from "@/src/layout/tokens";
import type { ImageFit, PageBriefSummary } from "@/src/layout/types";
import type { DocumentPlan, PageRole, StoryboardItem } from "@/src/planner/types";

export type NarrativeMetric = {
  label: string;
  value: string;
};

type NarrativeMetrics = {
  items: NarrativeMetric[];
  debugOnly: boolean;
};

export type PageNarrative = {
  kicker: string;
  title: string;
  subtitle: string;
  body: string;
  bullets: string[];
  chips: string[];
  callout: string;
  footer: string;
  metrics: NarrativeMetric[];
  metricsDebugOnly: boolean;
};

export type PageBrief = PageBriefSummary & {
  templateId: TemplateId;
  fallbackTemplateIds: TemplateId[];
  narrative: PageNarrative;
  imageFit: ImageFit;
  docKind: DocumentPlan["requestSpec"]["docKind"];
};

type CopyDraft = {
  kicker: string;
  title: string;
  subtitle: string;
  body: string;
  points: string[];
  callout: string;
};

type ContentSeed = {
  subject: string;
  summary: string;
  detail: string;
  highlights: string[];
  contact: string;
};

const BANNED_VAGUE_WORDS = [
  "혁신",
  "최고",
  "완벽",
  "최첨단",
  "synergy",
  "best-in-class",
  "game changer",
  "world class",
  "cutting edge",
];

const INTERNAL_TERM_REPLACEMENTS: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  { pattern: /\brequestspec\b/giu, replacement: "요청 정보" },
  { pattern: /\bvariantindex\b/giu, replacement: "버전" },
  { pattern: /\breferencedigest\b/giu, replacement: "참조 해시" },
  { pattern: /\btheme-factory\b/giu, replacement: "테마 적용" },
  { pattern: /\bwebapp-testing\b/giu, replacement: "런타임 검증" },
  { pattern: /\bvalidation\b/giu, replacement: "검증" },
  { pattern: /\blayout\b/giu, replacement: "구성" },
];

const PLACEHOLDERS = {
  subject: "[주제]",
  name: "[이름]",
  intro: "[한 줄 소개]",
  feature1: "[특징 1]",
  feature2: "[특징 2]",
  feature3: "[특징 3]",
  contact: "(추후 기입)",
  metric: "(추후 기입)",
};

const ROLE_LABELS: Record<PageRole, string> = {
  cover: "표지",
  "section-divider": "섹션 전환",
  agenda: "목차",
  insight: "핵심 인사이트",
  solution: "솔루션",
  process: "프로세스",
  timeline: "타임라인",
  metrics: "지표",
  comparison: "비교",
  gallery: "갤러리",
  "text-only": "텍스트",
  cta: "다음 단계",
  topic: "주제",
};

const TEMPLATE_LABELS: Record<TemplateId, string> = {
  COVER_HERO_BAND: "Cover Hero Band",
  COVER_SPLIT_MEDIA: "Cover Split Media",
  SECTION_DIVIDER: "Section Divider",
  AGENDA_EDITORIAL: "Agenda Editorial",
  TITLE_MEDIA_SAFE: "Title Media Safe",
  TWO_COLUMN_MEDIA_TEXT: "Two Column Media Text",
  METRICS_GRID: "Metrics Grid",
  PROCESS_FLOW: "Process Flow",
  TIMELINE_STEPS: "Timeline Steps",
  COMPARISON_TABLE: "Comparison Table",
  GALLERY_SINGLE: "Gallery Single",
  TEXT_ONLY_EDITORIAL: "Text Only Editorial",
  CTA_CONTACT: "CTA Contact",
  QUOTE_FOCUS: "Quote Focus",
};

function sanitizeText(value: string): string {
  return value.replace(/\uFEFF/g, "").replace(/\.\.\.$/g, "").replace(/\s+/g, " ").trim();
}

function stripInternalTerms(value: string): string {
  let next = value;
  for (const rule of INTERNAL_TERM_REPLACEMENTS) {
    next = next.replace(rule.pattern, rule.replacement);
  }
  return sanitizeText(next);
}

function shortText(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return "";
  }

  const normalized = sanitizeText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxLength).trimEnd();
  const byWordBoundary = sliced.replace(/\s+\S*$/u, "").trim();
  if (byWordBoundary.length >= Math.max(8, Math.floor(maxLength * 0.62))) {
    return byWordBoundary;
  }
  return sliced;
}

function cleanCaptionFromFilename(filename: string): string {
  const stem = path.parse(filename).name;
  const cleaned = stem
    .replace(/^\s*(?:\(\s*\d+\s*\)|p\s*\d+|\d+)(?:[\s._-]+)?/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "이미지";
}

function docTypeLabel(docType: DocumentPlan["docType"]): string {
  if (docType === "proposal") return "Brochure";
  if (docType === "poster") return "Poster";
  if (docType === "one-pager") return "One-pager";
  if (docType === "multi-card") return "Cards";
  return "Report";
}

function templateLabel(templateId: TemplateId): string {
  return TEMPLATE_LABELS[templateId] ?? "Template";
}

function sectionLabel(role: PageRole): string {
  return ROLE_LABELS[role] ?? "주제";
}

function pickImageFit(sourceImage: string | null): ImageFit {
  if (!sourceImage) {
    return "cover";
  }

  const normalized = sourceImage.toLowerCase();
  const containKeywords = ["ui", "screen", "dashboard", "report", "chart", "table", "화면"];
  if (containKeywords.some((keyword) => normalized.includes(keyword))) {
    return "contain";
  }
  return "cover";
}

function splitSourceSentences(value: string): string[] {
  return value
    .split(/[\n.!?]+/g)
    .map((item) => stripInternalTerms(item))
    .filter(Boolean);
}

function isDefaultTitle(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "visual_document" || normalized === "visual document";
}

function topicHint(topicLabel: string): string {
  if (topicLabel === "ui") return "화면 중심";
  if (topicLabel === "photo") return "사진 중심";
  if (topicLabel === "chart") return "지표 중심";
  if (topicLabel === "diagram") return "흐름 중심";
  if (topicLabel === "people") return "인물 중심";
  return "핵심 메시지";
}

function topicMetricLabel(topicLabel: string): string {
  if (topicLabel === "ui") return "UI";
  if (topicLabel === "photo") return "Photo";
  if (topicLabel === "chart") return "Data";
  if (topicLabel === "diagram") return "Flow";
  if (topicLabel === "people") return "People";
  return "General";
}

function uniquePreserveOrder(values: string[]): string[] {
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

function buildImageHints(plan: DocumentPlan): string[] {
  const hints = plan.topicClusters
    .flatMap((cluster) => cluster.images.slice(0, 2))
    .map((image) => cleanCaptionFromFilename(image.filename))
    .map((value) => stripInternalTerms(value))
    .filter(Boolean);
  return uniquePreserveOrder(hints).slice(0, 4);
}

function buildContentSeed(item: StoryboardItem, plan: DocumentPlan, caption: string): ContentSeed {
  const sourcePieces = [plan.requestSpec.contentBrief, plan.requestSpec.prompt]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
  const sourceText = stripInternalTerms(sourcePieces.join(" "));
  const sourceSentences = splitSourceSentences(sourceText);
  const imageHints = buildImageHints(plan);

  const titleCandidate = isDefaultTitle(plan.docTitle) ? "" : stripInternalTerms(plan.docTitle);
  const sentenceSubject = sourceSentences[0] ? shortText(sourceSentences[0], 36) : "";
  const subject = titleCandidate || sentenceSubject || imageHints[0] || PLACEHOLDERS.subject;
  const summary = sourceSentences[1] || sourceSentences[0] || `${topicHint(item.topicLabel)} 메시지를 요약합니다`;
  const detail =
    sourceSentences[2] ||
    `${caption} 정보를 중심으로 필요한 문구를 채우며, 확인되지 않은 사실은 ${PLACEHOLDERS.contact}으로 표시합니다`;

  const highlights = uniquePreserveOrder(
    [
      sourceSentences[0] ?? "",
      sourceSentences[1] ?? "",
      sourceSentences[2] ?? "",
      imageHints[0] ?? "",
      imageHints[1] ?? "",
      topicHint(item.topicLabel),
    ]
      .map((value) => stripInternalTerms(value ?? ""))
      .filter(Boolean),
  ).slice(0, 8);

  return {
    subject: subject || PLACEHOLDERS.subject,
    summary: summary || `${topicHint(item.topicLabel)}를 간결하게 정리합니다`,
    detail,
    highlights: highlights.length > 0 ? highlights : [caption, topicHint(item.topicLabel)],
    contact: PLACEHOLDERS.contact,
  };
}

function posterDraft(seed: ContentSeed, plan: DocumentPlan): CopyDraft {
  return {
    kicker: `POSTER / ${plan.requestSpec.language}`,
    title: shortText(seed.subject, 28) || PLACEHOLDERS.name,
    subtitle: shortText(seed.summary, 48) || PLACEHOLDERS.intro,
    body: shortText(
      `${seed.detail}. 숫자/성과/연락처 등 확인이 필요한 정보는 ${PLACEHOLDERS.contact}으로 표시합니다.`,
      220,
    ),
    points: [
      shortText(seed.highlights[0] ?? PLACEHOLDERS.feature1, 52),
      shortText(seed.highlights[1] ?? PLACEHOLDERS.feature2, 52),
      shortText(seed.highlights[2] ?? PLACEHOLDERS.feature3, 52),
      shortText(`다음 단계: ${PLACEHOLDERS.contact}`, 52),
    ],
    callout: `연락/링크: ${seed.contact}`,
  };
}

function buildDraft(item: StoryboardItem, plan: DocumentPlan, caption: string): CopyDraft {
  const seed = buildContentSeed(item, plan, caption);

  if (plan.requestSpec.docKind === "poster" || plan.requestSpec.docKind === "poster_set") {
    if (item.role === "cover" || item.role === "topic" || item.role === "gallery" || item.role === "cta") {
      return posterDraft(seed, plan);
    }
  }

  if (item.role === "cover") {
    return {
      kicker: `${docTypeLabel(plan.docType)} / ${plan.requestSpec.language}`,
      title: shortText(seed.subject, 32),
      subtitle: shortText(seed.summary, 52),
      body: shortText(seed.detail, 180),
      points: [
        shortText(seed.highlights[0] ?? "핵심 메시지", 44),
        shortText(seed.highlights[1] ?? "근거 요약", 44),
        shortText(seed.highlights[2] ?? "실행 포인트", 44),
      ],
      callout: `문의/링크 ${seed.contact}`,
    };
  }

  if (item.role === "metrics") {
    return {
      kicker: "지표",
      title: "측정 기준",
      subtitle: "확정되지 않은 수치는 (추후 기입)으로 둡니다",
      body: "측정 정의와 입력 방식부터 정리하고, 값은 확인 후 업데이트합니다.",
      points: [
        `기준값 ${PLACEHOLDERS.metric}`,
        `현재값 ${PLACEHOLDERS.metric}`,
        `목표값 ${PLACEHOLDERS.metric}`,
        "측정 주기 (추후 기입)",
      ],
      callout: "측정 책임자: (추후 기입)",
    };
  }

  if (item.role === "cta") {
    return {
      kicker: "다음 단계",
      title: "실행 체크리스트",
      subtitle: "담당/기한/의사결정 항목을 한 번에 정리",
      body: "바로 실행 가능한 항목부터 확정하고, 불확실한 정보는 (추후 기입)으로 표시합니다.",
      points: [
        "담당자: (추후 기입)",
        "기한: (추후 기입)",
        "필요 자원: (추후 기입)",
        "리스크 대응: (추후 기입)",
      ],
      callout: `연락/링크 ${seed.contact}`,
    };
  }

  return {
    kicker: sectionLabel(item.role),
    title: shortText(seed.subject, 32),
    subtitle: shortText(seed.summary, 52),
    body: shortText(seed.detail, 180),
    points: [
      shortText(seed.highlights[0] ?? PLACEHOLDERS.feature1, 44),
      shortText(seed.highlights[1] ?? PLACEHOLDERS.feature2, 44),
      shortText(seed.highlights[2] ?? PLACEHOLDERS.feature3, 44),
    ],
    callout: "핵심 메시지를 짧은 문장과 불릿으로 정리합니다",
  };
}

function budgetByDocKind(budget: TextBudget, docKind: DocumentPlan["requestSpec"]["docKind"]): TextBudget {
  if (docKind !== "poster" && docKind !== "poster_set") {
    return budget;
  }

  return {
    title: Math.min(budget.title, 24),
    subtitle: Math.min(budget.subtitle, 42),
    body: Math.min(budget.body, 86),
    bullet: Math.min(budget.bullet, 28),
    bullets: Math.min(budget.bullets, 5),
    callout: Math.min(budget.callout, 64),
  };
}

function applyBudget(copy: CopyDraft, budget: TextBudget): CopyDraft {
  return {
    kicker: shortText(copy.kicker, 28),
    title: shortText(copy.title, budget.title),
    subtitle: shortText(copy.subtitle, budget.subtitle),
    body: shortText(copy.body, budget.body),
    points: copy.points.slice(0, Math.max(1, budget.bullets)).map((point) => shortText(point, budget.bullet)),
    callout: shortText(copy.callout, budget.callout),
  };
}

function removeVagueWords(value: string): string {
  let next = value;
  for (const word of BANNED_VAGUE_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
  }
  return sanitizeText(next);
}

function cleanDraft(copy: CopyDraft): CopyDraft {
  return {
    kicker: stripInternalTerms(removeVagueWords(copy.kicker)),
    title: stripInternalTerms(removeVagueWords(copy.title)),
    subtitle: stripInternalTerms(removeVagueWords(copy.subtitle)),
    body: stripInternalTerms(removeVagueWords(copy.body)),
    points: copy.points.map((item) => stripInternalTerms(removeVagueWords(item))).filter(Boolean),
    callout: stripInternalTerms(removeVagueWords(copy.callout)),
  };
}

function bulletize(points: string[], budgetBullets: number, maxChars = 38): string[] {
  const list = points
    .map((point) => shortText(stripInternalTerms(sanitizeText(point)), Math.max(12, maxChars)))
    .filter(Boolean)
    .slice(0, Math.max(1, budgetBullets));

  if (list.length > 0) {
    return list;
  }

  return ["핵심 항목을 추후 입력합니다"];
}

function fitCheck(params: {
  copy: CopyDraft;
  budget: TextBudget;
  tokens: LayoutTokens;
}): CopyDraft {
  const lineBudget = Math.max(3, Math.floor((params.budget.body / Math.max(12, params.tokens.fontScalePt.body)) * 3));
  const estimatedLines = Math.ceil(params.copy.body.length / 24) + params.copy.points.length;

  if (estimatedLines <= lineBudget) {
    return params.copy;
  }

  const reducedBulletCount = Math.max(2, params.copy.points.length - 1);
  if (reducedBulletCount < params.copy.points.length) {
    return {
      ...params.copy,
      points: params.copy.points.slice(0, reducedBulletCount),
    };
  }

  const reducedBodyBudget = Math.max(48, Math.floor(params.budget.body * 0.78));

  return {
    ...params.copy,
    body: shortText(params.copy.body, reducedBodyBudget),
    callout: shortText(params.copy.callout, Math.floor(params.budget.callout * 0.85)),
  };
}

function buildMetrics(item: StoryboardItem, plan: DocumentPlan): NarrativeMetrics {
  const progress = `${item.pageNumber}/${plan.pageCount}p`;
  const roleLabel = sectionLabel(item.role);
  const topicLabel = topicMetricLabel(item.topicLabel);

  if (item.role === "metrics") {
    return {
      items: [
        { label: "페이지 수", value: String(plan.pageCount) },
        { label: "검증 자산", value: String(plan.proofAssetCount) },
        { label: "저신호 자산", value: String(plan.lowSignalAssetCount) },
      ],
      debugOnly: false,
    };
  }

  return {
    items: [
      { label: "섹션", value: roleLabel },
      { label: "토픽", value: topicLabel },
      { label: "진행", value: progress },
    ],
    debugOnly: false,
  };
}

function blockText(block: CopyDeckBlock): string {
  return sanitizeText(block.text ?? "");
}

function blockItems(block: CopyDeckBlock): string[] {
  if (!Array.isArray(block.items)) {
    return [];
  }
  return block.items.map((item) => sanitizeText(String(item))).filter(Boolean);
}

function pickFirstBlockText(blocks: CopyDeckBlock[], kind: CopyDeckBlock["kind"]): string {
  for (const block of blocks) {
    if (block.kind !== kind) {
      continue;
    }
    const value = blockText(block);
    if (value) {
      return value;
    }
  }
  return "";
}

function pickParagraphText(blocks: CopyDeckBlock[]): string {
  const paragraphs = blocks
    .filter((block) => block.kind === "paragraph")
    .map((block) => blockText(block))
    .filter(Boolean);
  return paragraphs.join("\n\n");
}

function pickBullets(blocks: CopyDeckBlock[], limit: number, bulletMaxChars: number): string[] {
  const values: string[] = [];
  for (const block of blocks) {
    if (block.kind !== "bullets") {
      continue;
    }
    values.push(...blockItems(block));
  }
  return bulletize(values, Math.max(1, limit), bulletMaxChars);
}

function parseMetricsFromCopyDeck(blocks: CopyDeckBlock[]): NarrativeMetric[] {
  const items = blocks
    .filter((block) => block.kind === "metrics")
    .flatMap((block) => blockItems(block))
    .slice(0, 4);

  if (items.length === 0) {
    return [];
  }

  return items.map((item, index) => {
    const [left, right] = item.split(/[:|-]/, 2).map((value) => sanitizeText(value));
    if (right) {
      return {
        label: shortText(left || `Metric ${index + 1}`, 20),
        value: shortText(right, 30),
      };
    }
    return {
      label: `Metric ${index + 1}`,
      value: shortText(item, 30),
    };
  });
}

function mergeNarrativeWithCopyDeck(params: {
  narrative: PageNarrative;
  copyDeckPage: CopyDeckPage;
  maxBullets: number;
  bulletMaxChars: number;
}): PageNarrative {
  const blocks = params.copyDeckPage.blocks;
  const headline = pickFirstBlockText(blocks, "headline");
  const subhead = pickFirstBlockText(blocks, "subhead");
  const paragraph = pickParagraphText(blocks);
  const callout = pickFirstBlockText(blocks, "callout");
  const footer = pickFirstBlockText(blocks, "footer");
  const chips = blocks
    .filter((block) => block.kind === "chips")
    .flatMap((block) => blockItems(block))
    .slice(0, 3);
  const bullets = pickBullets(blocks, params.maxBullets, params.bulletMaxChars);
  const metrics = parseMetricsFromCopyDeck(blocks);

  return {
    ...params.narrative,
    title: headline || params.narrative.title,
    subtitle: subhead || params.narrative.subtitle,
    body: paragraph || params.narrative.body,
    bullets: bullets.length > 0 ? bullets : params.narrative.bullets,
    callout: callout || params.narrative.callout,
    footer: footer || params.narrative.footer,
    chips: chips.length > 0 ? chips : params.narrative.chips,
    metrics: metrics.length > 0 ? metrics : params.narrative.metrics,
    metricsDebugOnly: false,
  };
}

export function buildPageBrief(params: {
  item: StoryboardItem;
  plan: DocumentPlan;
  templateId: TemplateId;
  copyTightness: number;
  tokens: LayoutTokens;
  copyDeckPage?: CopyDeckPage | null;
}): PageBrief {
  const spec = getTemplateSpec(params.templateId);
  const budget = budgetByDocKind(spec.maxTextBudget, params.plan.requestSpec.docKind);
  const maxBullets =
    params.templateId === "TEXT_ONLY_EDITORIAL" || params.templateId === "AGENDA_EDITORIAL"
      ? Math.min(6, budget.bullets)
      : Math.min(5, budget.bullets);
  const sourceImage = params.item.primaryAssetFilename;
  const imageCaption = sourceImage ? cleanCaptionFromFilename(sourceImage) : "이미지 없음";

  const pipelineLog: string[] = [];
  pipelineLog.push("draft");
  let copy = buildDraft({ ...params.item, templateId: params.templateId }, params.plan, imageCaption);

  pipelineLog.push("budget-shorten");
  copy = applyBudget(copy, budget);

  pipelineLog.push("remove-vague");
  copy = cleanDraft(copy);

  pipelineLog.push("bulletize");
  copy = {
    ...copy,
    points: bulletize(copy.points, maxBullets, budget.bullet),
  };

  pipelineLog.push("fit-check");
  copy = fitCheck({
    copy,
    budget,
    tokens: params.tokens,
  });

  if (params.copyTightness > 0) {
    pipelineLog.push(`tighten-x${params.copyTightness}`);
    const reducedBulletTarget = Math.max(2, Math.min(maxBullets, copy.points.length - params.copyTightness));
    copy = {
      ...copy,
      points: copy.points.slice(0, reducedBulletTarget),
    };
  }

  if (params.copyTightness > 1) {
    pipelineLog.push("sentence-shorten");
    const tightenRatio = 0.72;
    copy = {
      ...copy,
      title: shortText(copy.title, Math.floor(budget.title * tightenRatio)),
      subtitle: shortText(copy.subtitle, Math.floor(budget.subtitle * tightenRatio)),
      body: shortText(copy.body, Math.floor(budget.body * tightenRatio)),
      callout: shortText(copy.callout, Math.floor(budget.callout * tightenRatio)),
    };
  }

  const chips = [docTypeLabel(params.plan.docType), params.item.topicLabel]
    .map((value) => shortText(value, 16))
    .filter(Boolean);
  const narrativeMetrics = buildMetrics(params.item, params.plan);

  let narrative: PageNarrative = {
    kicker: shortText(copy.kicker, 28),
    title: shortText(copy.title, budget.title),
    subtitle: shortText(copy.subtitle, budget.subtitle),
    body: shortText(copy.body, budget.body),
    bullets: bulletize(copy.points, maxBullets, budget.bullet),
    chips,
    callout: shortText(copy.callout, budget.callout),
    footer: shortText(`${params.plan.docTitle} / page ${params.item.pageNumber}`, 96),
    metrics: narrativeMetrics.items,
    metricsDebugOnly: narrativeMetrics.debugOnly,
  };

  if (params.copyDeckPage) {
    pipelineLog.push("copydeck-override");
    narrative = mergeNarrativeWithCopyDeck({
      narrative,
      copyDeckPage: params.copyDeckPage,
      maxBullets,
      bulletMaxChars: budget.bullet,
    });

    narrative = {
      ...narrative,
      kicker: shortText(narrative.kicker, 28),
      title: shortText(narrative.title, budget.title),
      subtitle: shortText(narrative.subtitle, budget.subtitle),
      body: shortText(narrative.body, budget.body),
      bullets: bulletize(narrative.bullets, maxBullets, budget.bullet),
      chips: narrative.chips.map((value) => shortText(value, 16)).filter(Boolean).slice(0, 3),
      callout: shortText(narrative.callout, budget.callout),
      footer: shortText(narrative.footer, 96),
      metrics: narrative.metrics.slice(0, 4).map((metric, index) => ({
        label: shortText(metric.label || `Metric ${index + 1}`, 20),
        value: shortText(metric.value, 30),
      })),
    };
  }

  if (params.copyDeckPage && params.copyTightness > 0) {
    pipelineLog.push(`copydeck-tighten-x${params.copyTightness}`);
    const reducedBulletTarget = Math.max(1, narrative.bullets.length - params.copyTightness);
    narrative = {
      ...narrative,
      bullets: narrative.bullets.slice(0, reducedBulletTarget),
    };
  }

  if (params.copyDeckPage && params.copyTightness > 1) {
    pipelineLog.push("copydeck-sentence-shorten");
    const tightenRatio = 0.78;
    narrative = {
      ...narrative,
      subtitle: shortText(narrative.subtitle, Math.floor(budget.subtitle * tightenRatio)),
      body: shortText(narrative.body, Math.floor(budget.body * tightenRatio)),
      callout: shortText(narrative.callout, Math.floor(budget.callout * tightenRatio)),
    };
  }

  if (!sourceImage && params.item.role === "gallery") {
    narrative.body = "대표 이미지가 없어 텍스트 중심 설명으로 대체했습니다";
  }

  const summary: PageBriefSummary = {
    pageRole: sectionLabel(params.item.role),
    sourceImage,
    imageCaption,
    topic: params.item.topicLabel,
    template: templateLabel(params.templateId),
    templateReason: `${sectionLabel(params.item.role)} 구성에 ${templateLabel(params.templateId)} 템플릿을 적용`,
    readingFlow: spec.readingFlow,
    maxTextBudget: budget,
    copyPipelineLog: pipelineLog,
  };

  return {
    ...summary,
    templateId: params.templateId,
    fallbackTemplateIds: spec.fallbackTemplateIds,
    narrative,
    imageFit: pickImageFit(sourceImage),
    docKind: params.plan.requestSpec.docKind,
  };
}
