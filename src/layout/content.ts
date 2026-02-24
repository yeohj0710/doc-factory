import path from "node:path";
import type { ImageFit, PageBriefSummary, TextBudgetSummary } from "@/src/layout/types";
import { getTemplateSpec, type TemplateId } from "@/src/layout/templateCatalog";
import type { DocumentPlan, PageRole, StoryboardItem } from "@/src/planner/types";

export type NarrativeMetric = {
  label: string;
  value: string;
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
};

export type PageBrief = PageBriefSummary & {
  templateId: TemplateId;
  fallbackTemplateId: TemplateId;
  narrative: PageNarrative;
  imageFit: ImageFit;
};

function cleanCaptionFromFilename(filename: string): string {
  const stem = path.parse(filename).name;
  return stem
    .replace(/^\s*(?:\(\s*\d+\s*\)|p\s*\d+|\d+)(?:[\s._-]+)?/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortText(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return "";
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickBySeed<T>(list: readonly T[], seed: number, offset = 0): T {
  return list[(seed + offset) % list.length] as T;
}

function sectionLabel(role: PageRole): string {
  if (role === "cover") {
    return "Cover";
  }
  if (role === "agenda") {
    return "Agenda";
  }
  if (role === "problem") {
    return "Problem";
  }
  if (role === "solution") {
    return "Solution";
  }
  if (role === "process") {
    return "Process";
  }
  if (role === "proof") {
    return "Proof";
  }
  if (role === "package") {
    return "Package";
  }
  if (role === "cta") {
    return "CTA";
  }
  return "Topic";
}

function pickImageFit(sourceImage: string | null): ImageFit {
  if (!sourceImage) {
    return "cover";
  }

  const normalized = sourceImage.toLowerCase();
  const containKeywords = ["앱", "web", "ui", "screen", "화면", "report", "레포트", "dashboard"];
  if (containKeywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
    return "contain";
  }

  return "cover";
}

function clampBullets(values: readonly string[], bulletLimit: number, bulletChars: number): string[] {
  return values.slice(0, Math.max(1, bulletLimit)).map((item) => shortText(item, bulletChars));
}

function agendaBullets(plan: DocumentPlan): string[] {
  return plan.narrativeSections.map((role, index) => `${index + 1}. ${sectionLabel(role)}`);
}

function buildRoleBullets(item: StoryboardItem, plan: DocumentPlan, caption: string): string[] {
  if (item.role === "agenda") {
    return agendaBullets(plan);
  }
  if (item.role === "problem") {
    return [
      "고정형 복용 구조의 한계 확인",
      "개입 지점과 운영 병목을 분리",
      `현재 자산(${caption}) 기준 문제 정의`,
      "개선 우선순위를 문서로 합의",
    ];
  }
  if (item.role === "solution") {
    return [
      "도입 범위를 단계별로 분할",
      "운영/상담/리포트 역할 명확화",
      "자산 기반 설명으로 의사결정 단축",
      "현장 적용 기준을 페이지에 고정",
    ];
  }
  if (item.role === "process") {
    return [
      "진단 입력 정리",
      "추천/검수 분기",
      "패키지 확정",
      "정기 리포트 회수",
      "다음 사이클 반영",
    ];
  }
  if (item.role === "proof") {
    return [
      "정량 지표 3개 이상 명시",
      "근거 이미지/화면과 연결",
      "성과 해석 문장을 짧게 유지",
    ];
  }
  if (item.role === "package") {
    return [
      "제공 항목을 운영 단위로 분리",
      "필수/옵션 구성 구분",
      "도입 이후 운영 책임 명확화",
      "확장 가능한 계약 단위 제시",
    ];
  }
  if (item.role === "cta") {
    return [
      "파일럿 대상 확정",
      "운영 일정 잠정 합의",
      "성과 지표/리포트 포맷 합의",
      "다음 미팅 안건 확정",
    ];
  }
  if (item.role === "cover") {
    return ["문서 목적과 대상 즉시 전달", "문제-해결-증빙 순서로 구성", "도입 의사결정에 필요한 정보만 배치"];
  }
  return [
    `${item.topicLabel} 관점 핵심 포인트`,
    "중복 이미지는 배제",
    "설명은 1문장 + 불릿 중심",
  ];
}

function roleTitles(item: StoryboardItem, plan: DocumentPlan, caption: string): {
  kicker: string;
  title: string;
  subtitle: string;
  body: string;
  callout: string;
} {
  if (item.role === "cover") {
    return {
      kicker: `${plan.documentGoal} · ${plan.targetAudience}`,
      title: plan.docTitle,
      subtitle: "문서 단위 스토리보드 기반으로 핵심 메시지를 빠르게 전달합니다.",
      body: `대표 자산: ${caption}. 이 문서는 문제 정의부터 실행 제안, 증빙, 다음 액션까지 한 흐름으로 구성됩니다.`,
      callout: "핵심: 이미지 수에 맞추지 않고 문서 목적에 맞춰 페이지를 설계합니다.",
    };
  }

  if (item.role === "agenda") {
    return {
      kicker: "Document Structure",
      title: "이번 제안서의 진행 순서",
      subtitle: "중복 설명 없이 의사결정에 필요한 섹션만 남겼습니다.",
      body: "아젠다는 실행 흐름 기준으로 구성했습니다. 각 섹션은 다음 섹션의 근거로 이어집니다.",
      callout: "한 페이지당 1개 메시지 원칙을 유지합니다.",
    };
  }

  if (item.role === "problem") {
    return {
      kicker: "Current Problem",
      title: "현재 운영에서 반복되는 비효율",
      subtitle: "왜 지금 구조를 바꿔야 하는지 근거 중심으로 정리합니다.",
      body: `현 상태는 업무 단계가 분리되지 않아 병목이 발생합니다. 자산(${caption}) 기준으로 문제를 구체화했습니다.`,
      callout: "문제는 추상 표현 대신 관찰 가능한 항목으로 명시합니다.",
    };
  }

  if (item.role === "solution") {
    return {
      kicker: "Proposed Solution",
      title: "실행 가능한 설계안",
      subtitle: "담당자 관점에서 바로 적용 가능한 구조로 제시합니다.",
      body: `자산(${caption})을 기준으로 도입 흐름과 담당 역할을 함께 배치했습니다.`,
      callout: "실행 순서와 운영 책임을 분리해 리스크를 낮춥니다.",
    };
  }

  if (item.role === "process") {
    return {
      kicker: "Operating Flow",
      title: "도입 후 운영 프로세스",
      subtitle: "3~5단계로 나눠 일정/의사결정 포인트를 명확히 합니다.",
      body: "각 단계 산출물이 다음 단계 입력으로 연결되도록 정의합니다.",
      callout: "단계가 명확하면 운영 품질 편차가 줄어듭니다.",
    };
  }

  if (item.role === "proof") {
    return {
      kicker: "Evidence",
      title: "성과 확인을 위한 증빙 구조",
      subtitle: "정량 지표와 정성 근거를 같은 페이지에서 확인합니다.",
      body: `현재 보유 자산(${caption})에서 추출 가능한 근거를 우선 사용합니다.`,
      callout: "불확실한 수치는 쓰지 않고 확인 가능한 지표만 배치합니다.",
    };
  }

  if (item.role === "package") {
    return {
      kicker: "Package",
      title: "제공 패키지와 운영 범위",
      subtitle: "필수/옵션 항목을 분리해 도입 범위를 선명하게 만듭니다.",
      body: "운영 리소스와 기대 산출물을 함께 제시해 합의 시간을 줄입니다.",
      callout: "패키지 설명은 가격 문구보다 운영 단위 정의를 우선합니다.",
    };
  }

  if (item.role === "cta") {
    return {
      kicker: "Next Action",
      title: "도입 결정을 위한 다음 단계",
      subtitle: "바로 실행 가능한 체크리스트로 마무리합니다.",
      body: "회의 종료 시점에 누가 무엇을 결정할지 명확히 적습니다.",
      callout: "CTA는 한 문장으로 끝내고, 실행 항목은 불릿으로 분리합니다.",
    };
  }

  return {
    kicker: "Topic Focus",
    title: `${item.topicLabel} 중심 정리`,
    subtitle: "중복 자산을 배제하고 하나의 메시지에 집중합니다.",
    body: `대표 자산: ${caption}. 해당 주제에서 필요한 근거만 간결하게 정리했습니다.`,
    callout: "한 페이지 한 메시지 원칙을 유지합니다.",
  };
}

function buildMetrics(item: StoryboardItem, plan: DocumentPlan): NarrativeMetric[] {
  const baseMetrics: NarrativeMetric[] = [
    { label: "페이지 수", value: `${plan.pageCount}p` },
    { label: "증빙 자산", value: `${plan.proofAssetCount}개` },
    { label: "템플릿", value: item.templateId },
  ];

  if (item.role === "proof") {
    return [
      { label: "증빙 자산", value: `${plan.proofAssetCount}개` },
      { label: "주요 토픽", value: item.topicLabel },
      { label: "검증 상태", value: "게이트 통과 기준" },
    ];
  }

  if (item.role === "process") {
    return [
      { label: "프로세스 단계", value: "3~5단계" },
      { label: "운영 단위", value: "페이지별 기준 고정" },
      { label: "리뷰 주기", value: "정기 점검" },
    ];
  }

  return baseMetrics;
}

export function buildPageBrief(item: StoryboardItem, plan: DocumentPlan): PageBrief {
  const spec = getTemplateSpec(item.templateId);
  const sourceImage = item.primaryAssetFilename;
  const imageCaption = sourceImage ? cleanCaptionFromFilename(sourceImage) : "이미지 없음";
  const seed = stableHash(`${plan.docTitle}|${item.pageNumber}|${sourceImage ?? "none"}|${item.templateId}`);

  const roleCopy = roleTitles(item, plan, imageCaption);
  const roleBullets = buildRoleBullets(item, plan, imageCaption);

  const chipsPool = [
    item.topicLabel,
    sectionLabel(item.role),
    plan.documentGoal,
    plan.targetAudience,
    sourceImage ? "이미지 기반" : "텍스트 중심",
  ] as const;

  const narrative: PageNarrative = {
    kicker: shortText(roleCopy.kicker, 24),
    title: shortText(roleCopy.title, spec.maxTextBudget.title),
    subtitle: shortText(roleCopy.subtitle, spec.maxTextBudget.subtitle),
    body: shortText(roleCopy.body, spec.maxTextBudget.body),
    bullets: clampBullets(roleBullets, spec.maxTextBudget.bullets, spec.maxTextBudget.bullet),
    chips: [
      shortText(pickBySeed(chipsPool, seed, 0), 16),
      shortText(pickBySeed(chipsPool, seed, 1), 16),
      shortText(pickBySeed(chipsPool, seed, 2), 16),
    ],
    callout: shortText(roleCopy.callout, spec.maxTextBudget.callout),
    footer: shortText(`${plan.docTitle} | ${item.pageNumber}페이지 | ${spec.label}`, 96),
    metrics: buildMetrics(item, plan),
  };

  const brief: PageBrief = {
    pageRole: sectionLabel(item.role),
    sourceImage,
    imageCaption,
    topic: item.topicLabel,
    template: spec.label,
    templateReason: `${item.role} 역할에 맞는 ${spec.label} 적용`,
    readingFlow: spec.readingFlow,
    maxTextBudget: spec.maxTextBudget as TextBudgetSummary,
    templateId: item.templateId,
    fallbackTemplateId: spec.fallbackTemplateId,
    narrative,
    imageFit: pickImageFit(sourceImage),
  };

  return brief;
}
