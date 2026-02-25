import path from "node:path";
import type { LayoutTokens } from "@/src/layout/tokens";
import { getTemplateSpec, type TemplateId, type TextBudget } from "@/src/layout/templateCatalog";
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
  introMode: boolean;
  contact: string;
};

const BANNED_VAGUE_WORDS = [
  "혁신",
  "최고",
  "완벽",
  "압도",
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
  { pattern: /\bvariantindex\b/giu, replacement: "버전 값" },
  { pattern: /\breferencedigest\b/giu, replacement: "참조 식별값" },
  { pattern: /\btheme-factory\b/giu, replacement: "테마 적용" },
  { pattern: /\bwebapp-testing\b/giu, replacement: "실행 검증" },
  { pattern: /\bvalidation\b/giu, replacement: "검토" },
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

function sanitizeText(value: string): string {
  return value
    .replace(/…/g, "")
    .replace(/\.\.\.$/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  return cleaned || "자산";
}

function docTypeLabel(docType: DocumentPlan["docType"]): string {
  if (docType === "proposal") return "Brochure";
  if (docType === "poster") return "Poster";
  if (docType === "one-pager") return "One-pager";
  if (docType === "multi-card") return "Cards";
  return "Report";
}

function templateLabel(templateId: TemplateId): string {
  if (templateId === "COVER_HERO_BAND") return "Cover Hero Band";
  if (templateId === "COVER_SPLIT_MEDIA") return "Cover Split Media";
  if (templateId === "SECTION_DIVIDER") return "Section Divider";
  if (templateId === "AGENDA_EDITORIAL") return "Agenda Editorial";
  if (templateId === "TITLE_MEDIA_SAFE") return "Title Media Safe";
  if (templateId === "TWO_COLUMN_MEDIA_TEXT") return "Two Column Media Text";
  if (templateId === "METRICS_GRID") return "Metrics Grid";
  if (templateId === "PROCESS_FLOW") return "Process Flow";
  if (templateId === "TIMELINE_STEPS") return "Timeline Steps";
  if (templateId === "COMPARISON_TABLE") return "Comparison Table";
  if (templateId === "GALLERY_SINGLE") return "Gallery Single";
  if (templateId === "TEXT_ONLY_EDITORIAL") return "Text Only Editorial";
  if (templateId === "CTA_CONTACT") return "CTA Contact";
  return "Quote Focus";
}

function sectionLabel(role: PageRole): string {
  if (role === "cover") return "표지";
  if (role === "section-divider") return "구분";
  if (role === "agenda") return "목차";
  if (role === "insight") return "핵심";
  if (role === "solution") return "해결안";
  if (role === "process") return "프로세스";
  if (role === "timeline") return "일정";
  if (role === "metrics") return "지표";
  if (role === "comparison") return "비교";
  if (role === "gallery") return "갤러리";
  if (role === "text-only") return "텍스트";
  if (role === "cta") return "다음 단계";
  return "주제";
}

function pickImageFit(sourceImage: string | null): ImageFit {
  if (!sourceImage) {
    return "cover";
  }

  const normalized = sourceImage.toLowerCase();
  const containKeywords = ["ui", "screen", "dashboard", "앱", "화면", "report", "chart", "table"];
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
  if (topicLabel === "photo") return "장면 중심";
  if (topicLabel === "chart") return "지표 중심";
  if (topicLabel === "diagram") return "구조 중심";
  if (topicLabel === "people") return "인물 중심";
  return "핵심 장면";
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
  const topicBasedHint = topicHint(item.topicLabel);

  const titleCandidate = isDefaultTitle(plan.docTitle) ? "" : stripInternalTerms(plan.docTitle);
  const sentenceSubject = sourceSentences[0] ? shortText(sourceSentences[0], 36) : "";
  const subject = titleCandidate || sentenceSubject || imageHints[0] || PLACEHOLDERS.subject;
  const summary = sourceSentences[1] || sourceSentences[0] || `${topicBasedHint} 메시지를 정리합니다.`;
  const detail = sourceSentences[2] || `${caption} 중심으로 핵심 정보만 배치합니다.`;
  const highlights = uniquePreserveOrder(
    [
      sourceSentences[0],
      sourceSentences[1],
      imageHints[0],
      imageHints[1],
      topicBasedHint,
    ]
      .map((value) => stripInternalTerms(value ?? ""))
      .filter(Boolean),
  ).slice(0, 4);

  const introMode = /(?:소개|프로필|profile|about|friend|친구)/iu.test(sourceText) || /(?:소개|프로필)/iu.test(plan.docTitle);

  return {
    subject: subject || PLACEHOLDERS.subject,
    summary: summary || `${topicBasedHint} 핵심을 전달합니다.`,
    detail: detail || `${topicBasedHint} 포인트를 짧게 제시합니다.`,
    highlights: highlights.length > 0 ? highlights : [caption, topicBasedHint],
    introMode,
    contact: PLACEHOLDERS.contact,
  };
}

function posterDraft(seed: ContentSeed, plan: DocumentPlan): CopyDraft {
  const title = seed.introMode ? PLACEHOLDERS.name : seed.subject;
  const subtitle = seed.introMode ? PLACEHOLDERS.intro : shortText(seed.summary, 30);
  const bullets = seed.introMode
    ? [PLACEHOLDERS.feature1, PLACEHOLDERS.feature2, PLACEHOLDERS.feature3]
    : [
        shortText(seed.highlights[0] ?? PLACEHOLDERS.feature1, 16),
        shortText(seed.highlights[1] ?? PLACEHOLDERS.feature2, 16),
        shortText(seed.highlights[2] ?? PLACEHOLDERS.feature3, 16),
      ];

  return {
    kicker: `${docTypeLabel(plan.docType)} / ${plan.requestSpec.language}`,
    title,
    subtitle,
    body: shortText(seed.detail, 52),
    points: bullets,
    callout: `연락처 ${seed.contact}`,
  };
}

function buildDraft(item: StoryboardItem, plan: DocumentPlan, caption: string): CopyDraft {
  const seed = buildContentSeed(item, plan, caption);
  const isPosterSeries = plan.requestSpec.docKind === "poster" || plan.requestSpec.docKind === "poster_set";

  if (item.role === "cover" && isPosterSeries) {
    return posterDraft(seed, plan);
  }

  if (item.role === "cover") {
    return {
      kicker: `${docTypeLabel(plan.docType)} / ${plan.requestSpec.language}`,
      title: seed.subject,
      subtitle: seed.summary,
      body: `${seed.detail}`,
      points: [
        shortText(seed.highlights[0] ?? "핵심 메시지 정리", 24),
        shortText(seed.highlights[1] ?? "주요 정보 요약", 24),
        shortText(seed.highlights[2] ?? "다음 행동 제안", 24),
      ],
      callout: `문의 및 링크 ${seed.contact}`,
    };
  }

  if (item.role === "agenda") {
    return {
      kicker: "개요",
      title: "진행 순서",
      subtitle: "읽는 흐름을 먼저 고정합니다",
      body: shortText(seed.detail, 96),
      points: [
        shortText(seed.highlights[0] ?? "핵심 맥락 확인", 26),
        shortText(seed.highlights[1] ?? "주요 근거 정리", 26),
        "실행 항목 확정",
        "담당과 일정 확인",
      ],
      callout: "중요한 항목부터 짧게 배치합니다.",
    };
  }

  if (item.role === "insight") {
    return {
      kicker: "핵심 관찰",
      title: shortText(seed.subject, 30),
      subtitle: shortText(seed.summary, 40),
      body: shortText(seed.detail, 104),
      points: ["관찰 포인트", "근거 메모", "해석 메모"],
      callout: "사실과 해석을 분리해 기록합니다.",
    };
  }

  if (item.role === "solution") {
    return {
      kicker: "실행 제안",
      title: "실행 구조",
      subtitle: shortText(seed.summary, 44),
      body: shortText(seed.detail, 102),
      points: ["단계 1", "단계 2", "단계 3", "검토 지점"],
      callout: "각 단계에 책임과 산출물을 명시합니다.",
    };
  }

  if (item.role === "process" || item.role === "timeline") {
    return {
      kicker: "진행 흐름",
      title: item.role === "timeline" ? "주요 일정" : "프로세스",
      subtitle: "단계 간 연결을 명확히 정리합니다",
      body: shortText(seed.detail, 98),
      points: ["준비", "실행", "점검", "공유", "다음 사이클"],
      callout: "완료 기준이 있는 단계만 남깁니다.",
    };
  }

  if (item.role === "metrics") {
    return {
      kicker: "지표",
      title: "측정 기준",
      subtitle: "확정되지 않은 수치는 비워둡니다",
      body: "수치가 없을 때는 정의와 측정 방법부터 합의합니다.",
      points: [
        `기준값: ${PLACEHOLDERS.metric}`,
        `현재값: ${PLACEHOLDERS.metric}`,
        `목표값: ${PLACEHOLDERS.metric}`,
      ],
      callout: "숫자는 확인 후 입력합니다.",
    };
  }

  if (item.role === "comparison") {
    return {
      kicker: "비교",
      title: "선택지 차이",
      subtitle: "같은 기준으로만 비교합니다",
      body: shortText(seed.detail, 94),
      points: ["요건 충족", "운영 난이도", "비용", "리스크"],
      callout: "비교 기준은 페이지 상단에 고정합니다.",
    };
  }

  if (item.role === "gallery") {
    return {
      kicker: "대표 장면",
      title: shortText(seed.subject, 28),
      subtitle: shortText(seed.summary, 30),
      body: shortText(`${caption} 장면의 의미를 짧게 전달합니다.`, 70),
      points: [shortText(seed.highlights[0] ?? "장면 요약", 20), "활용 맥락", "확인 메모"],
      callout: "이미지와 문장이 같은 메시지를 가리키게 맞춥니다.",
    };
  }

  if (item.role === "text-only") {
    return {
      kicker: "텍스트 정리",
      title: shortText(seed.subject, 28),
      subtitle: "이미지 없이도 핵심이 전달되게 구성",
      body: shortText(seed.detail, 106),
      points: ["핵심 주장", "근거", "예외 조건", "실행 조건"],
      callout: "문장은 짧게, 항목은 명확하게 유지합니다.",
    };
  }

  if (item.role === "cta") {
    return {
      kicker: "다음 단계",
      title: "실행 체크리스트",
      subtitle: "담당과 일정을 한 번에 정리",
      body: "즉시 실행 가능한 항목만 남겨서 마무리합니다.",
      points: ["담당자: (추후 기입)", "기한: (추후 기입)", "점검 일정", "리스크 확인"],
      callout: `연락/링크 ${PLACEHOLDERS.contact}`,
    };
  }

  return {
    kicker: sectionLabel(item.role),
    title: shortText(seed.subject, 30),
    subtitle: shortText(seed.summary, 44),
    body: shortText(seed.detail, 104),
    points: [PLACEHOLDERS.feature1, PLACEHOLDERS.feature2, PLACEHOLDERS.feature3],
    callout: "핵심 메시지를 한 줄로 정리합니다.",
  };
}

function budgetByDocKind(budget: TextBudget, docKind: DocumentPlan["requestSpec"]["docKind"]): TextBudget {
  if (docKind !== "poster" && docKind !== "poster_set") {
    return budget;
  }

  return {
    title: Math.min(budget.title, 22),
    subtitle: Math.min(budget.subtitle, 30),
    body: Math.min(budget.body, 66),
    bullet: Math.min(budget.bullet, 16),
    bullets: Math.min(budget.bullets, 3),
    callout: Math.min(budget.callout, 34),
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

function bulletize(points: string[], budgetBullets: number): string[] {
  const list = points
    .map((point) => stripInternalTerms(sanitizeText(point)))
    .filter(Boolean)
    .slice(0, Math.max(1, budgetBullets));

  if (list.length > 0) {
    return list;
  }

  return ["핵심 항목을 짧게 정리합니다."];
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
      { label: "문서 유형", value: docTypeLabel(plan.docType) },
      { label: "언어", value: plan.requestSpec.language },
      { label: "톤", value: plan.requestSpec.tone },
    ],
    debugOnly: true,
  };
}

export function buildPageBrief(params: {
  item: StoryboardItem;
  plan: DocumentPlan;
  templateId: TemplateId;
  copyTightness: number;
  tokens: LayoutTokens;
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
    points: bulletize(copy.points, maxBullets),
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

  const narrative: PageNarrative = {
    kicker: shortText(copy.kicker, 28),
    title: shortText(copy.title, budget.title),
    subtitle: shortText(copy.subtitle, budget.subtitle),
    body: shortText(copy.body, budget.body),
    bullets: bulletize(copy.points, maxBullets),
    chips,
    callout: shortText(copy.callout, budget.callout),
    footer: shortText(`${params.plan.docTitle} · ${params.item.pageNumber}페이지`, 96),
    metrics: narrativeMetrics.items,
    metricsDebugOnly: narrativeMetrics.debugOnly,
  };

  if (!sourceImage && params.item.role === "gallery") {
    narrative.body = "대표 이미지가 없어 텍스트 설명으로 대체했습니다.";
  }

  const summary: PageBriefSummary = {
    pageRole: sectionLabel(params.item.role),
    sourceImage,
    imageCaption,
    topic: params.item.topicLabel,
    template: templateLabel(params.templateId),
    templateReason: `${sectionLabel(params.item.role)} 구성에 ${templateLabel(params.templateId)} 적용`,
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
  };
}
