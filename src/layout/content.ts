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
const B2B_SERVICE_TITLE_KEYWORD = "영양설계서비스소개서";
const B2B_SERVICE_KEYWORDS = ["소분", "건기식", "약사", "상담", "리포트", "레포트", "패키지", "앱"];

function sanitizeText(value: string): string {
  return value
    .replace(/…/g, "")
    .replace(/\.\.\.$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s_.\-()/\\]+/g, "");
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
  if (docType === "proposal") return "Proposal";
  if (docType === "poster") return "Poster";
  if (docType === "one-pager") return "One-pager";
  if (docType === "multi-card") return "Multi-card";
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
  if (role === "insight") return "Insight";
  if (role === "solution") return "해결안";
  if (role === "process") return "Process";
  if (role === "timeline") return "Timeline";
  if (role === "metrics") return "지표";
  if (role === "comparison") return "Comparison";
  if (role === "gallery") return "갤러리";
  if (role === "text-only") return "Text";
  if (role === "cta") return "CTA";
  return "Topic";
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

function isB2BSalesServicePlan(plan: DocumentPlan): boolean {
  if (normalize(plan.docTitle).includes(B2B_SERVICE_TITLE_KEYWORD)) {
    return true;
  }

  let score = 0;
  for (const cluster of plan.topicClusters) {
    for (const image of cluster.images) {
      if (B2B_SERVICE_KEYWORDS.some((keyword) => normalize(image.filename).includes(normalize(keyword)))) {
        score += 1;
      }
      if (score >= 3) {
        return true;
      }
    }
  }

  return false;
}

function buildB2BSalesServiceDraft(item: StoryboardItem, plan: DocumentPlan): CopyDraft | null {
  if (!isB2BSalesServicePlan(plan)) {
    return null;
  }

  if (item.pageNumber === 1 || item.role === "cover") {
    return {
      kicker: "기업 복지 제안서",
      title: "고정 복용이 아닌, 매주 조정되는 영양 설계",
      subtitle: "약국 기반 1알 단위 소분 조제 서비스",
      body: "AI 추천과 약사 DAY 상담을 결합해 임직원별 복용 조합을 지속적으로 조정합니다.",
      points: ["1알 단위 소분 조제", "최소 7일 단위 조합 변경", "월 1회 정기 배송"],
      callout: "핵심 가치는 고정 처방이 아닌 지속 조정입니다.",
    };
  }

  if (item.pageNumber === 2 || item.role === "text-only") {
    return {
      kicker: "기존 방식의 문제",
      title: "일괄 구매형 건기식 복지는 개인차를 반영하기 어렵습니다",
      subtitle: "1통 단위 지급 중심 구조의 운영 한계",
      body: "구성 변경 주기가 길고 상담 연결이 약해 복약 지속률과 체감 효과가 함께 떨어집니다.",
      points: [
        "1통 단위 지급, 개인 맞춤 한계",
        "상태 변화 반영이 늦음",
        "상담 부재로 신뢰 저하",
        "기업 효과 데이터 부족",
      ],
      callout: "복지비를 써도 체감 효과가 약하면 재도입 근거가 약해집니다.",
    };
  }

  if (item.pageNumber === 3 || item.role === "solution") {
    return {
      kicker: "우리의 솔루션",
      title: "AI 추천과 약사 상담을 결합한 맞춤 소분 조제",
      subtitle: "개인 데이터와 전문 판단을 함께 반영",
      body: "자체 설문과 복용 데이터를 분석한 뒤 약사 DAY 상담으로 조합을 확정하고 조제합니다.",
      points: ["AI 1차 추천", "약사 DAY 최종 상담", "1알 단위 맞춤 조제", "개인 리포트 제공"],
      callout: "추천 정확도는 데이터와 상담의 결합에서 올라갑니다.",
    };
  }

  if (item.pageNumber === 4 || item.role === "process" || item.role === "timeline") {
    return {
      kicker: "B2B 운영 프로세스",
      title: "설문부터 배송까지 월간 운영 체계를 표준화합니다",
      subtitle: "설문 -> 분석 -> 약사 DAY -> 조제 -> 배송",
      body: "기업 담당자는 월간 운영 리포트를 확인하고, 임직원은 개인별 조정 내역을 확인합니다.",
      points: ["자체 설문 수집", "데이터 분석", "약사 DAY 상담", "맞춤 소분 조제", "월 1회 배송"],
      callout: "단계별 입력 데이터와 책임 주체를 고정해 운영 편차를 줄입니다.",
    };
  }

  if (item.pageNumber === 5 || item.role === "comparison") {
    return {
      kicker: "차별점",
      title: "7일 단위 조정과 피드백 루프가 결과를 만듭니다",
      subtitle: "정적 패키지 방식과의 핵심 차이",
      body: "복용 피드백을 다음 조제에 반영해 개인 상태 변화에 맞춰 조합을 계속 업데이트합니다.",
      points: [
        "최소 7일 단위 리밸런싱",
        "복용 피드백 반영 루프",
        "AI + 약사 이중 검토",
        "월간 리포트로 변화 추적",
      ],
      callout: "고정 조합이 아니라 조정 가능한 조합이 실제 복용 지속성을 높입니다.",
    };
  }

  if (item.pageNumber === 6 || item.role === "metrics") {
    return {
      kicker: "기업 도입 효과",
      title: "복지 만족도와 운영 가시성을 동시에 높입니다",
      subtitle: "임직원 체감과 조직 의사결정을 함께 개선",
      body: "개인 맞춤 복지 경험을 제공하면서 데이터 기반 운영 리포트로 내부 보고 근거를 확보합니다.",
      points: [
        "임직원 복지 체감도 향상",
        "복지 참여율 개선",
        "데이터 기반 운영 의사결정",
        "ESG 커뮤니케이션 근거 확보",
      ],
      callout: "복지를 비용이 아닌 유지율과 참여율 지표로 관리할 수 있습니다.",
    };
  }

  if (item.pageNumber === 7 || item.role === "cta") {
    return {
      kicker: "도입 제안",
      title: "3개월 파일럿으로 빠르게 검증하고 확장하십시오",
      subtitle: "패키지 구성과 리포트 샘플을 함께 제공합니다",
      body: "대상 인원과 예산을 확정하면 약사 DAY 일정과 월간 리포트 체계를 포함한 실행안을 제시합니다.",
      points: ["대상 인원/예산 확정", "샘플 패키지 공유", "약사 DAY 일정 확정", "3개월 파일럿 시작"],
      callout: "의사결정에 필요한 자료를 1주 내 전달드리겠습니다.",
    };
  }

  return null;
}

function buildDraft(item: StoryboardItem, plan: DocumentPlan, caption: string): CopyDraft {
  const salesBriefDraft = buildB2BSalesServiceDraft(item, plan);
  if (salesBriefDraft) {
    return salesBriefDraft;
  }

  const topic = item.topicLabel;

  if (item.role === "cover") {
    return {
      kicker: docTypeLabel(plan.docType),
      title: plan.docTitle,
      subtitle: `문서 타입 ${docTypeLabel(plan.docType)} 기준으로 스토리보드를 구성했습니다.`,
      body: `${caption} 자산을 기준으로 문제 정의, 실행 방식, 검증 조건, 다음 액션까지 순차적으로 정리합니다.`,
      points: [
        "페이지 수는 이미지 수가 아니라 문서 목적 기준으로 계산",
        "템플릿 반복은 최대 2회로 제한",
        "검증 통과 전 export 금지",
      ],
      callout: "핵심 메시지: 계획-검증-내보내기 흐름을 하나의 체계로 유지합니다.",
    };
  }

  if (item.role === "agenda") {
    return {
      kicker: "개요",
      title: "문서 진행 순서",
      subtitle: "페이지별 역할을 먼저 고정한 뒤 자산을 배치합니다.",
      body: "아젠다는 의사결정 흐름과 검증 포인트를 기준으로 구성되어 중복 설명을 줄입니다.",
      points: [
        "핵심 문제와 근거를 먼저 제시",
        "실행 방식과 일정은 분리해서 설명",
        "마지막 페이지는 결정 가능한 액션으로 종료",
      ],
      callout: "아젠다 페이지는 다음 페이지의 판단 기준을 정의합니다.",
    };
  }

  if (item.role === "process" || item.role === "timeline") {
    return {
      kicker: "실행",
      title: item.role === "timeline" ? "실행 타임라인" : "운영 프로세스",
      subtitle: "단계 간 입력/출력 조건을 명확히 고정합니다.",
      body: "단계별 담당, 산출물, 검증 기준을 분리하면 운영 중 품질 편차를 줄일 수 있습니다.",
      points: ["입력 정보 수집", "중간 검토", "배포/운영", "리포트 회수", "다음 사이클 반영"],
      callout: "각 단계는 완료 조건이 있어야 다음 단계로 이동할 수 있습니다.",
    };
  }

  if (item.role === "metrics") {
    return {
      kicker: "근거",
      title: "정량 지표와 결과 확인",
      subtitle: "측정 가능한 항목만 남기고 추정 문구는 배제합니다.",
      body: `${caption} 자료에서 확인 가능한 값만 사용해 성과와 리스크를 함께 표시합니다.`,
      points: ["지표 정의", "측정 주기", "허용 오차", "개선 액션"],
      callout: "숫자는 기준값, 현재값, 목표값 세 가지로 표현합니다.",
    };
  }

  if (item.role === "comparison") {
    return {
      kicker: "비교표",
      title: "선택지 비교",
      subtitle: "조건/비용/리스크를 동일 축으로 비교합니다.",
      body: "비교표는 결론을 유도하기 위한 장치이며 항목 정의가 다르면 같은 표에서 비교하지 않습니다.",
      points: ["필수 조건 충족 여부", "운영 난이도", "도입 비용", "유지관리 부담"],
      callout: "비교 기준은 사전에 합의된 항목만 사용합니다.",
    };
  }

  if (item.role === "cta") {
    return {
      kicker: "다음 단계",
      title: "다음 단계 확정",
      subtitle: "회의 종료 시 실행 항목이 남도록 정리합니다.",
      body: "담당자, 기한, 산출물, 검토 시점을 한 페이지에 배치해 즉시 실행 가능 상태로 마무리합니다.",
      points: ["담당자 지정", "기한 확정", "검토 미팅 예약", "리스크 체크"],
      callout: "CTA는 단문으로 작성하고 실행 목록은 불릿으로 분리합니다.",
    };
  }

  if (item.role === "gallery") {
    return {
      kicker: "핵심 장면",
      title: "대표 자산 하이라이트",
      subtitle: `${caption}를 중심으로 메시지를 한 문장으로 고정합니다.`,
      body: "이미지는 1개만 사용해 주의를 분산시키지 않고 설명은 필요한 최소 길이로 유지합니다.",
      points: ["핵심 장면 설명", "활용 맥락", "검증 메모"],
      callout: "이미지 중심 페이지는 설명 텍스트를 과도하게 늘리지 않습니다.",
    };
  }

  if (item.role === "text-only") {
    return {
      kicker: "핵심 정리",
      title: "이미지 없이 정리한 핵심 논리",
      subtitle: "근거-주장-행동을 텍스트만으로 연결합니다.",
      body: "이미지가 부족하거나 저신호 자산 비중이 높을 때 텍스트 중심 페이지로 문서 리듬을 회복합니다.",
      points: ["핵심 주장", "근거 항목", "예외 조건", "실행 조건"],
      callout: "텍스트 페이지는 멀티 페이지 문서에서 최소 1회 포함됩니다.",
    };
  }

  return {
    kicker: sectionLabel(item.role),
    title: `${sectionLabel(item.role)} 페이지 핵심`,
    subtitle: `${topic} 토픽을 기준으로 페이지 메시지를 정리합니다.`,
    body: `${caption} 자산을 선택 근거로 사용하고, 확인 가능한 항목만 포함합니다. 의미가 불명확하면 중립 문장을 1개만 유지합니다.`,
    points: ["핵심 메시지 1개 유지", "보조 근거를 짧게 첨부", "페이지 목적과 성공조건 정렬"],
    callout: "페이지 요소는 템플릿 예산 범위 내에서만 유지합니다.",
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
  if (isB2BSalesServicePlan(plan)) {
    if (item.role === "metrics") {
      return {
        items: [
          { label: "조제 단위", value: "1알 단위" },
          { label: "조정 주기", value: "최소 7일" },
          { label: "배송 주기", value: "월 1회" },
        ],
        debugOnly: false,
      };
    }
    return {
      items: [
        { label: "운영 형태", value: "B2B 계약" },
        { label: "상담 체계", value: "약사 DAY" },
      ],
      debugOnly: true,
    };
  }

  const summary: NarrativeMetric[] = [
    { label: "페이지 수", value: `${plan.pageCount}` },
    { label: "문서 유형", value: docTypeLabel(plan.docType) },
    { label: "스타일", value: "선택됨" },
  ];

  if (item.role === "metrics") {
    return {
      items: [
        { label: "검증 자산", value: `${plan.proofAssetCount}` },
        { label: "저신호 자산", value: `${plan.lowSignalAssetCount}` },
      ],
      debugOnly: false,
    };
  }

  return {
    items: summary,
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

