import path from "node:path";
import type { LayoutTokens } from "@/src/layout/tokens";
import { getTemplateSpec, type TemplateId } from "@/src/layout/templateCatalog";
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

function sanitizeText(value: string): string {
  return value
    .replace(/…/g, "")
    .replace(/\.\.\.$/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function buildDraft(item: StoryboardItem, plan: DocumentPlan, caption: string): CopyDraft {
  const language = plan.requestSpec.language;
  const tone = plan.requestSpec.tone;
  const unknownMetricLabel = "(추후 기입)";

  if (item.role === "cover") {
    return {
      kicker: `${docTypeLabel(plan.docType)} / ${language}`,
      title: plan.docTitle,
      subtitle: `${tone} 톤으로 구성한 ${plan.pageCount}페이지 문서`,
      body: `${caption} 자산을 기반으로 흐름을 먼저 정의하고 페이지별 메시지를 간결한 불릿 중심으로 정리합니다.`,
      points: [
        "RequestSpec 기준으로 페이지 수 고정",
        "레이아웃 게이트 통과 전 export 차단",
        "참조 인덱스 조건을 감사 로그로 증명",
      ],
      callout: "메시지는 짧게, 근거는 검증 가능한 항목만 사용합니다.",
    };
  }

  if (item.role === "agenda") {
    return {
      kicker: "개요",
      title: "문서 진행 순서",
      subtitle: "판단 흐름이 보이도록 페이지 역할을 먼저 고정합니다",
      body: "아젠다는 설명 순서가 아니라 의사결정 순서를 기준으로 구성합니다.",
      points: [
        "목표와 제약 조건 확인",
        "핵심 근거 및 비교 포인트 정리",
        "실행 계획과 검증 항목 확정",
        "다음 단계 담당/기한 정의",
      ],
      callout: "아젠다에서 정한 순서를 나머지 페이지가 그대로 따릅니다.",
    };
  }

  if (item.role === "insight") {
    return {
      kicker: "핵심 인사이트",
      title: "현재 상태에서 가장 중요한 관찰",
      subtitle: "문제 정의와 근거를 같은 축으로 배치합니다",
      body: "관찰 문장은 한 문장으로 요약하고, 바로 아래에 검증 가능한 근거를 연결합니다.",
      points: ["핵심 관찰 1개", "확인 가능한 근거 2~3개", "해석과 사실 분리"],
      callout: "인사이트 페이지는 주장보다 근거가 먼저 보여야 합니다.",
    };
  }

  if (item.role === "solution") {
    return {
      kicker: "해결안",
      title: "실행 가능한 구조로 정리한 제안",
      subtitle: "복잡한 설명 대신 책임과 결과 중심으로 작성",
      body: "제안은 기능 목록이 아니라 단계와 책임 주체로 표현합니다.",
      points: ["단계별 책임", "필요 입력", "산출물 형태", "검토 지점"],
      callout: "실행 단위가 보이면 문서의 설득력이 올라갑니다.",
    };
  }

  if (item.role === "process" || item.role === "timeline") {
    return {
      kicker: "실행 흐름",
      title: item.role === "timeline" ? "주요 일정" : "운영 프로세스",
      subtitle: "단계 간 입력과 출력을 분리해 오류를 줄입니다",
      body: "각 단계는 완료 조건이 있어야 다음 단계로 진행할 수 있습니다.",
      points: ["입력 수집", "중간 점검", "실행/배포", "결과 회수", "다음 사이클 반영"],
      callout: "프로세스 페이지는 읽는 순간 다음 행동이 떠올라야 합니다.",
    };
  }

  if (item.role === "metrics") {
    return {
      kicker: "지표",
      title: "측정 기준과 상태",
      subtitle: "수치가 불명확한 항목은 생성하지 않습니다",
      body: "확정되지 않은 수치 대신 지표 정의와 측정 방식만 먼저 합의합니다.",
      points: [
        `기준값: ${unknownMetricLabel}`,
        `현재값: ${unknownMetricLabel}`,
        `목표값: ${unknownMetricLabel}`,
      ],
      callout: "모르는 숫자는 비워두고 측정 방법을 먼저 고정합니다.",
    };
  }

  if (item.role === "comparison") {
    return {
      kicker: "비교",
      title: "선택지 간 차이 정리",
      subtitle: "같은 기준으로만 비교합니다",
      body: "조건, 비용, 리스크를 동일한 축에서 비교해 결정을 돕습니다.",
      points: ["필수 조건 충족 여부", "운영 난이도", "도입 비용", "리스크"],
      callout: "비교 축이 다르면 표를 분리해서 작성합니다.",
    };
  }

  if (item.role === "gallery") {
    return {
      kicker: "대표 자산",
      title: "핵심 장면 하이라이트",
      subtitle: `${caption} 중심으로 메시지를 단문으로 유지`,
      body: "이미지 중심 페이지는 본문을 길게 쓰지 않고 핵심 해석만 남깁니다.",
      points: ["장면 설명", "활용 맥락", "검증 메모"],
      callout: "이미지와 본문이 서로 같은 메시지를 가리켜야 합니다.",
    };
  }

  if (item.role === "text-only") {
    return {
      kicker: "텍스트 정리",
      title: "이미지 없이도 전달되는 핵심 논리",
      subtitle: "근거-주장-행동 순서로 압축",
      body: "텍스트 전용 페이지는 문서의 논리 축을 고정하는 용도로 사용합니다.",
      points: ["핵심 주장", "근거 항목", "예외 조건", "실행 조건"],
      callout: "문장이 길어지면 먼저 항목 수를 줄입니다.",
    };
  }

  if (item.role === "cta") {
    return {
      kicker: "다음 단계",
      title: "바로 실행할 항목 확정",
      subtitle: "담당자와 기한을 한 페이지에서 마무리",
      body: "회의 종료 시 즉시 실행 가능한 상태를 만드는 것이 목표입니다.",
      points: ["담당자 지정", "기한 확정", "검토 일정", "리스크 체크"],
      callout: "CTA는 선택지가 아니라 실행 목록이어야 합니다.",
    };
  }

  return {
    kicker: sectionLabel(item.role),
    title: `${sectionLabel(item.role)} 페이지 핵심`,
    subtitle: `${item.topicLabel} 토픽 기준 메시지 정리`,
    body: `${caption} 자산에서 확인 가능한 정보만 사용해 페이지 목적을 명확히 유지합니다.`,
    points: ["핵심 메시지 1개", "근거 2~3개", "다음 행동 1개"],
    callout: "텍스트 예산을 넘기면 먼저 텍스트를 줄입니다.",
  };
}

function applyBudget(draft: CopyDraft, budget: ReturnType<typeof getTemplateSpec>["maxTextBudget"]): CopyDraft {
  return {
    kicker: shortText(draft.kicker, 28),
    title: shortText(draft.title, budget.title),
    subtitle: shortText(draft.subtitle, budget.subtitle),
    body: shortText(draft.body, budget.body),
    points: draft.points.slice(0, Math.max(1, budget.bullets)).map((point) => shortText(point, budget.bullet)),
    callout: shortText(draft.callout, budget.callout),
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
    kicker: removeVagueWords(copy.kicker),
    title: removeVagueWords(copy.title),
    subtitle: removeVagueWords(copy.subtitle),
    body: removeVagueWords(copy.body),
    points: copy.points.map((item) => removeVagueWords(item)).filter(Boolean),
    callout: removeVagueWords(copy.callout),
  };
}

function bulletize(points: string[], budgetBullets: number): string[] {
  const list = points
    .map((point) => sanitizeText(point))
    .filter(Boolean)
    .slice(0, Math.max(1, budgetBullets));

  if (list.length > 0) {
    return list;
  }

  return ["핵심 항목을 짧게 정리합니다."];
}

function fitCheck(params: {
  copy: CopyDraft;
  budget: ReturnType<typeof getTemplateSpec>["maxTextBudget"];
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
  const maxBullets =
    params.templateId === "TEXT_ONLY_EDITORIAL" || params.templateId === "AGENDA_EDITORIAL"
      ? Math.min(6, spec.maxTextBudget.bullets)
      : Math.min(5, spec.maxTextBudget.bullets);
  const sourceImage = params.item.primaryAssetFilename;
  const imageCaption = sourceImage ? cleanCaptionFromFilename(sourceImage) : "이미지 없음";

  const pipelineLog: string[] = [];
  pipelineLog.push("draft");
  let copy = buildDraft({ ...params.item, templateId: params.templateId }, params.plan, imageCaption);

  pipelineLog.push("budget-shorten");
  copy = applyBudget(copy, spec.maxTextBudget);

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
    budget: spec.maxTextBudget,
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
      title: shortText(copy.title, Math.floor(spec.maxTextBudget.title * tightenRatio)),
      subtitle: shortText(copy.subtitle, Math.floor(spec.maxTextBudget.subtitle * tightenRatio)),
      body: shortText(copy.body, Math.floor(spec.maxTextBudget.body * tightenRatio)),
      callout: shortText(copy.callout, Math.floor(spec.maxTextBudget.callout * tightenRatio)),
    };
  }

  const chips = [docTypeLabel(params.plan.docType), params.item.topicLabel]
    .map((value) => shortText(value, 16))
    .filter(Boolean);
  const narrativeMetrics = buildMetrics(params.item, params.plan);

  const narrative: PageNarrative = {
    kicker: shortText(copy.kicker, 28),
    title: shortText(copy.title, spec.maxTextBudget.title),
    subtitle: shortText(copy.subtitle, spec.maxTextBudget.subtitle),
    body: shortText(copy.body, spec.maxTextBudget.body),
    bullets: bulletize(copy.points, maxBullets),
    chips,
    callout: shortText(copy.callout, spec.maxTextBudget.callout),
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
    maxTextBudget: spec.maxTextBudget,
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
