import path from "node:path";
import type { ScannedImage } from "@/src/io/scanImages";
import type { PageBriefSummary, TextBudgetSummary } from "@/src/layout/types";

export type PageTemplateId =
  | "full-bleed-caption"
  | "title-image-safe"
  | "two-column-image-text";

export type PageCategory = "dispense" | "ai" | "consult" | "report" | "package" | "generic";

export type NarrativeMetric = {
  label: string;
  value: string;
};

export type PageNarrative = {
  kicker: string;
  title: string;
  subtitle: string;
  body: string;
  bullets: [string, string, string];
  chips: [string, string, string];
  callout: string;
  footer: string;
  metrics: [NarrativeMetric, NarrativeMetric, NarrativeMetric];
};

export type PageTemplateSpec = {
  id: PageTemplateId;
  label: string;
  intendedImageRatio: {
    min: number;
    max: number;
  };
  readingFlow: string;
  maxTextBudget: TextBudgetSummary;
  fallbackTemplate: PageTemplateId;
};

export type PageBrief = PageBriefSummary & {
  templateId: PageTemplateId;
  fallbackTemplateId: PageTemplateId;
  narrative: PageNarrative;
};

type CategoryLibrary = {
  kickerPool: readonly string[];
  titlePool: readonly string[];
  subtitlePool: readonly string[];
  bodyPool: readonly string[];
  bulletPool: readonly string[];
  chipPool: readonly string[];
  calloutPool: readonly string[];
  metrics: readonly [NarrativeMetric, NarrativeMetric, NarrativeMetric];
};

const TEMPLATE_SPEC_LIBRARY: Record<PageTemplateId, PageTemplateSpec> = {
  "full-bleed-caption": {
    id: "full-bleed-caption",
    label: "풀블리드 이미지 + 캡션",
    intendedImageRatio: { min: 1.1, max: 9.9 },
    readingFlow: "상단 메시지 → 중단 대표 이미지 → 하단 근거 블록",
    maxTextBudget: {
      title: 30,
      subtitle: 62,
      body: 120,
      bullet: 42,
      bullets: 3,
      callout: 78,
    },
    fallbackTemplate: "title-image-safe",
  },
  "title-image-safe": {
    id: "title-image-safe",
    label: "타이틀 + 이미지 안전형",
    intendedImageRatio: { min: 0.9, max: 1.8 },
    readingFlow: "헤드라인 → 이미지 인지 → 본문/근거 확인",
    maxTextBudget: {
      title: 38,
      subtitle: 78,
      body: 170,
      bullet: 50,
      bullets: 3,
      callout: 90,
    },
    fallbackTemplate: "full-bleed-caption",
  },
  "two-column-image-text": {
    id: "two-column-image-text",
    label: "2컬럼 이미지 + 텍스트",
    intendedImageRatio: { min: 0.5, max: 1.3 },
    readingFlow: "좌측 시각 근거 → 우측 설명 → 하단 도입 포인트",
    maxTextBudget: {
      title: 34,
      subtitle: 64,
      body: 150,
      bullet: 44,
      bullets: 3,
      callout: 72,
    },
    fallbackTemplate: "title-image-safe",
  },
};

const CATEGORY_LIBRARY: Record<PageCategory, CategoryLibrary> = {
  dispense: {
    kickerPool: ["7일 단위 소분조제", "정밀 맞춤 조합", "1알 단위 공급"],
    titlePool: [
      "고정 복용에서 맞춤 조합으로 전환",
      "건기식을 1통이 아닌 1알 단위로",
      "7일 단위 조정이 가능한 소분 모델",
    ],
    subtitlePool: [
      "필요 성분만 선택하고 주기적으로 배합을 수정해 낭비를 줄입니다.",
      "최소 7일 단위로 조합을 업데이트해 개인 반응에 빠르게 대응합니다.",
      "복용 후 피드백을 다음 조제에 즉시 반영하는 운영 구조입니다.",
    ],
    bodyPool: [
      "기존의 통 단위 구매는 조정 속도가 느리고 불필요한 재고가 남기 쉽습니다. 당사 모델은 7일 주기 소분조제를 통해 변화에 맞춰 성분을 바꿀 수 있습니다.",
      "소분 단위 공급은 초기 진입 장벽을 낮추고, 짧은 주기로 조합을 개선할 수 있어 실사용 적합도를 높입니다.",
    ],
    bulletPool: [
      "최소 7일 단위로 조합 재설계 가능",
      "성분 단위 변경이 쉬워 복용 부담 완화",
      "복용 반응을 다음 주기 조제에 반영",
      "필요 없는 대용량 구매를 줄여 비용 최적화",
      "약국/전문가 프로세스와 연동 가능한 구조",
    ],
    chipPool: ["7일 리밸런싱", "1알 단위", "소분조제", "정밀 맞춤"],
    calloutPool: [
      "핵심은 판매가 아니라 개인 적합도를 계속 높여가는 운영 루프입니다.",
      "고정 처방이 아닌 주기적 재조합으로 맞춤 정확도를 높입니다.",
    ],
    metrics: [
      { label: "조정 주기", value: "최소 7일" },
      { label: "공급 단위", value: "1알 단위 소분" },
      { label: "운영 방식", value: "반응 기반 리밸런싱" },
    ],
  },
  ai: {
    kickerPool: ["AI 추천 엔진", "설문 기반 분석", "개인화 추천"],
    titlePool: [
      "AI가 개인별 건기식 우선순위를 산출",
      "설문 결과를 실사용 추천으로 전환",
      "추천부터 배송까지 한 흐름으로 연결",
    ],
    subtitlePool: [
      "사용자 입력과 생활 패턴을 종합해 성분 우선순위를 도출합니다.",
      "추천 이유를 함께 제시해 임직원 수용성을 높입니다.",
      "추천 결과는 주문/배송 프로세스로 바로 이어집니다.",
    ],
    bodyPool: [
      "당사 추천 엔진은 자체 설계 설문 데이터를 기반으로 개인 상태와 목표를 점수화합니다. 추천 결과는 약사 검토 단계와 결합되어 실제 복용 가능한 조합으로 연결됩니다.",
      "추천 정확도는 사후 피드백 축적에 따라 지속적으로 개선되며, 단발성 처방이 아닌 업데이트 가능한 프로필로 운영됩니다.",
    ],
    bulletPool: [
      "자체 전문가 설계 설문을 데이터 입력점으로 사용",
      "AI 분석 결과와 약사 검토를 결합해 최종 추천",
      "추천 이유를 함께 제시해 설명 가능성 확보",
      "주기적 설문 업데이트로 추천 정확도 개선",
      "배송 연계로 실행 전환율을 높이는 구조",
    ],
    chipPool: ["AI 추천", "설문 분석", "설명 가능성", "배송 연계"],
    calloutPool: [
      "추천은 결과가 아니라 시작점이며, 피드백과 함께 계속 업데이트됩니다.",
      "AI 분석과 전문가 검토를 결합해 도입 리스크를 낮춥니다.",
    ],
    metrics: [
      { label: "추천 방식", value: "AI + 약사 검토" },
      { label: "입력 채널", value: "자체 설문 데이터" },
      { label: "실행 연결", value: "추천 후 배송 연계" },
    ],
  },
  consult: {
    kickerPool: ["약사 DAY 상담", "오프라인 상담 결합", "전문가 검토"],
    titlePool: [
      "설문 + 약사 상담으로 최종 정밀 추천",
      "임직원 현장 상담을 통한 정확도 보강",
      "AI 결과를 약사 검토로 최종 확정",
    ],
    subtitlePool: [
      "주기적으로 약사가 방문해 임직원과 직접 상담합니다.",
      "상담 결과를 데이터로 반영해 다음 추천에 연결합니다.",
      "현장 질문 대응으로 임직원 참여율을 높일 수 있습니다.",
    ],
    bodyPool: [
      "B2B 운영에서는 추천 정확도와 신뢰가 동시에 중요합니다. 당사는 사전 설문 결과와 약사 DAY 상담 메모를 결합해 개인별 최종 추천안을 확정합니다.",
      "상담 과정은 단순 안내가 아니라 성분 조정 의사결정 단계로 활용되며, 상담 이력은 후속 리포트와 다음 달 조합 설계에 반영됩니다.",
    ],
    bulletPool: [
      "사전 설문 결과 기반 상담 우선순위 설정",
      "약사 대면 상담으로 개인 이슈 확인",
      "상담 결과를 즉시 분석해 최종 추천 확정",
      "다음 조합 설계에 상담 이력 누적 반영",
      "기업 담당자에게 운영 진행 현황 공유 가능",
    ],
    chipPool: ["약사 방문", "대면 상담", "최종 검토", "현장 운영"],
    calloutPool: [
      "약사 DAY는 추천 정확도와 임직원 신뢰를 동시에 확보하는 핵심 단계입니다.",
      "현장 상담 데이터가 누적될수록 개인 맞춤 정밀도가 올라갑니다.",
    ],
    metrics: [
      { label: "상담 방식", value: "정기 약사 방문" },
      { label: "최종 추천", value: "설문 + 상담 통합" },
      { label: "운영 대상", value: "기업 임직원" },
    ],
  },
  report: {
    kickerPool: ["개인 맞춤 건강 리포트", "사후 피드백 루프", "변화 추적"],
    titlePool: [
      "개인 맞춤 리포트로 변화 과정을 가시화",
      "복용 후 피드백을 다음 조합에 반영",
      "사후 관리까지 포함한 운영 패키지",
    ],
    subtitlePool: [
      "정량/정성 피드백을 함께 기록해 개선 방향을 제시합니다.",
      "리포트는 결과 공유를 넘어 다음 처방 설계 입력값으로 사용됩니다.",
      "임직원과 담당자 모두 이해 가능한 언어로 보고합니다.",
    ],
    bodyPool: [
      "리포트는 단순 결과 요약 문서가 아니라 개인 맞춤 복용 전략을 업데이트하는 운영 도구입니다. 체감 변화와 상담 기록을 구조화해 다음 조합의 근거로 사용합니다.",
      "고정적으로 영양제를 유지하는 방식이 아니라, 피드백 기반으로 개인 적합도를 점진적으로 높여가는 과정 자체가 서비스 핵심입니다.",
    ],
    bulletPool: [
      "개인별 변화 추세를 월 단위로 기록",
      "복용 피드백을 다음 조합에 반영",
      "상담 코멘트와 수치 정보를 함께 제공",
      "기업 담당자 보고용 요약 지표 제공 가능",
      "지속 운영 시 개인 적합도 정밀도 상승",
    ],
    chipPool: ["월간 리포트", "피드백 반영", "변화 추적", "사후 관리"],
    calloutPool: [
      "우리 서비스의 본질은 고정 복용이 아니라 맞춤 정확도를 계속 높이는 과정입니다.",
      "리포트는 전달 자료가 아니라 다음 조합 설계를 위한 데이터입니다.",
    ],
    metrics: [
      { label: "리포트 주기", value: "월 1회" },
      { label: "핵심 가치", value: "사후 피드백 반영" },
      { label: "개선 방식", value: "반복 최적화" },
    ],
  },
  package: {
    kickerPool: ["기업 임직원 복지 패키지", "B2B 계약형 운영", "도입형 헬스케어"],
    titlePool: [
      "설문-상담-조제-배송-리포트 통합 패키지",
      "기업 복지에 바로 적용 가능한 맞춤 건기식 서비스",
      "임직원 대상 월 단위 정밀 영양관리 프로그램",
    ],
    subtitlePool: [
      "도입 기업의 일정에 맞춰 월 단위 운영이 가능합니다.",
      "임직원 설문과 약사 상담을 결합해 개인별 조합을 제공합니다.",
      "한 달치 소분 제품을 정기 배송하고 결과 리포트를 제공합니다.",
    ],
    bodyPool: [
      "B2B 패키지는 사전 설문 배포부터 약사 DAY 상담, 개인별 소분조제, 월 1회 배송, 건강 리포트까지 한 번에 제공합니다. 기업은 운영 부담을 줄이고 임직원은 맞춤형 복지 경험을 받습니다.",
      "복지 관점에서 중요한 것은 일회성 이벤트가 아닌 반복 가능한 운영입니다. 당사는 월 단위 루프로 결과를 축적하며 조직 단위 도입 효과를 높입니다.",
    ],
    bulletPool: [
      "자체 설문 배포/회수/분석을 통합 지원",
      "약사 DAY 상담으로 임직원 개별 이슈 반영",
      "개인 맞춤 성분 소분조제 후 월 1회 배송",
      "개인 맞춤 건강 리포트 패키지 제공",
      "기업 담당자 대상 운영 현황 공유 체계",
    ],
    chipPool: ["B2B 계약형", "월 1회 배송", "임직원 복지", "통합 패키지"],
    calloutPool: [
      "기업은 운영 부담을 줄이고, 임직원은 정밀한 맞춤 복지를 경험합니다.",
      "도입 이후에도 피드백 루프로 조합을 계속 개선하는 것이 차별점입니다.",
    ],
    metrics: [
      { label: "공급 주기", value: "월 1회 한 달치" },
      { label: "구성 항목", value: "설문·상담·조제·리포트" },
      { label: "도입 형태", value: "기업 복지 계약" },
    ],
  },
  generic: {
    kickerPool: ["맞춤 건기식 서비스", "기업 제안용 요약", "도입 가치 요약"],
    titlePool: [
      "임직원 맞춤 건기식 운영 서비스",
      "개인화 영양관리 B2B 소개",
      "피드백 기반 맞춤 건기식 프로그램",
    ],
    subtitlePool: [
      "설문과 상담을 결합해 개인별 조합을 제공합니다.",
      "복용 피드백을 반영해 고정 처방이 아닌 동적 최적화를 지향합니다.",
      "월 단위 공급과 리포트 제공으로 운영 완결성을 확보합니다.",
    ],
    bodyPool: [
      "당사 서비스는 임직원 건강 복지 도입을 위한 맞춤형 건기식 운영 모델입니다. 설문, 분석, 약사 상담, 소분조제, 배송, 리포트를 통합 제공해 실행 가능성을 높입니다.",
      "서비스 핵심은 개인 적합도를 주기적으로 개선하는 운영 루프에 있으며, 고정 성분 장기 복용의 한계를 보완합니다.",
    ],
    bulletPool: [
      "설문 기반 개인 상태 파악",
      "약사 검토를 통한 최종 추천",
      "소분조제로 유연한 조합 변경",
      "월 단위 정기 배송과 리포트 제공",
      "피드백 기반 반복 최적화",
    ],
    chipPool: ["맞춤 추천", "전문가 상담", "정기 배송", "리포트 제공"],
    calloutPool: [
      "단순 공급이 아니라 개인 적합도를 지속 개선하는 서비스 구조입니다.",
      "도입 이후 데이터가 쌓일수록 맞춤 정밀도가 향상됩니다.",
    ],
    metrics: [
      { label: "서비스 형태", value: "기업 대상 B2B" },
      { label: "운영 주기", value: "월 단위 반복 운영" },
      { label: "차별 포인트", value: "피드백 기반 최적화" },
    ],
  },
};

function cleanCaptionFromFilename(filename: string): string {
  const stem = path.parse(filename).name;
  const withoutPrefix = stem.replace(
    /^\s*(?:\(\s*\d+\s*\)|p\s*\d+|\d+)(?:[\s._-]+)?/i,
    "",
  );
  const normalized = withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const fallback = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized || fallback || "이미지";
}

function normalizeForKeywordMatch(filename: string): string {
  return path
    .parse(filename)
    .name.toLowerCase()
    .replace(/[\s_./\\()-]+/g, "");
}

function includesAnyKeyword(normalized: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => normalized.includes(keyword));
}

function shortText(value: string, maxLength: number): string {
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

function pickBySeed<T>(values: readonly T[], seed: number, offset = 0): T {
  return values[(seed + offset) % values.length];
}

function pickUnique(values: readonly string[], count: number, seed: number): string[] {
  if (values.length === 0 || count <= 0) {
    return [];
  }

  const selected: string[] = [];
  let cursor = seed % values.length;
  while (selected.length < count) {
    const candidate = values[cursor];
    if (!selected.includes(candidate)) {
      selected.push(candidate);
    }
    cursor = (cursor + 1) % values.length;
    if (selected.length === values.length) {
      break;
    }
  }
  return selected;
}

function imageRatio(image: ScannedImage): number {
  const width = image.widthPx ?? 1;
  const height = image.heightPx ?? 1;
  if (width <= 0 || height <= 0) {
    return 1;
  }
  return width / height;
}

function formatRatioForReason(ratio: number): string {
  return ratio.toFixed(2).replace(/\.00$/, "");
}

export function detectCategory(filename: string): PageCategory {
  const normalized = normalizeForKeywordMatch(filename);
  const reportKeywords = ["레포트", "리포트", "report", "summary", "insight"] as const;
  const consultKeywords = ["약사", "상담", "consult", "advisor", "pharmacist", "clinic"] as const;
  const packageKeywords = ["패키지", "기업", "임직원", "복지", "b2b", "package", "bundle"] as const;
  const aiKeywords = ["앱", "웹", "화면", "ai", "app", "mobile", "screen", "web"] as const;
  const dispenseKeywords = ["소분", "조제", "건기식", "영양", "pill", "dose", "dispense"] as const;

  if (includesAnyKeyword(normalized, reportKeywords)) {
    return "report";
  }
  if (includesAnyKeyword(normalized, consultKeywords)) {
    return "consult";
  }
  if (includesAnyKeyword(normalized, packageKeywords)) {
    return "package";
  }
  if (includesAnyKeyword(normalized, aiKeywords)) {
    return "ai";
  }
  if (includesAnyKeyword(normalized, dispenseKeywords)) {
    return "dispense";
  }
  return "generic";
}

export function getTemplateSpec(templateId: PageTemplateId): PageTemplateSpec {
  return TEMPLATE_SPEC_LIBRARY[templateId];
}

export function getFallbackTemplate(templateId: PageTemplateId): PageTemplateId {
  return TEMPLATE_SPEC_LIBRARY[templateId].fallbackTemplate;
}

function pickTemplateByImage(
  image: ScannedImage,
  category: PageCategory,
  imageIndex: number,
): {
  templateId: PageTemplateId;
  reason: string;
} {
  const ratio = imageRatio(image);

  if (category === "package" || category === "report") {
    return {
      templateId: "title-image-safe",
      reason: "패키지/리포트 유형은 설명 텍스트 비중이 높아 안정형 템플릿을 우선 적용",
    };
  }

  if (category === "consult" || category === "ai") {
    return {
      templateId: "two-column-image-text",
      reason: "프로세스 설명이 필요한 유형이므로 이미지-텍스트 분리형 2컬럼을 적용",
    };
  }

  if (ratio >= 1.35) {
    return {
      templateId: "full-bleed-caption",
      reason: `가로형 비율(${formatRatioForReason(ratio)}:1)로 대표 이미지를 강조하는 템플릿을 적용`,
    };
  }

  if (ratio <= 0.85) {
    return {
      templateId: "two-column-image-text",
      reason: `세로형 비율(${formatRatioForReason(ratio)}:1)로 텍스트 가독성이 높은 2컬럼을 적용`,
    };
  }

  if (imageIndex % 2 === 0) {
    return {
      templateId: "title-image-safe",
      reason: "균형형 비율 이미지에 안전한 타이틀+이미지 템플릿을 배치",
    };
  }

  return {
    templateId: "full-bleed-caption",
    reason: "균형형 비율 이미지에서 시각 임팩트를 높이기 위해 풀블리드 템플릿 적용",
  };
}

function buildNarrative(
  category: PageCategory,
  imageFilename: string,
  pageNumber: number,
  templateId: PageTemplateId,
  maxTextBudget: TextBudgetSummary,
): PageNarrative {
  const library = CATEGORY_LIBRARY[category];
  const caption = cleanCaptionFromFilename(imageFilename);
  const seed = stableHash(`${imageFilename}|${pageNumber}|${templateId}|${category}`);

  const kicker = shortText(pickBySeed(library.kickerPool, seed, 1), 22);
  const title = shortText(pickBySeed(library.titlePool, seed, 3), maxTextBudget.title);
  const subtitle = shortText(pickBySeed(library.subtitlePool, seed, 5), maxTextBudget.subtitle);
  const body = shortText(
    `${pickBySeed(library.bodyPool, seed, 7)} 시각 근거: ${caption}.`,
    maxTextBudget.body,
  );
  const selectedBullets = pickUnique(library.bulletPool, maxTextBudget.bullets, seed + 11).map(
    (item) => shortText(item, maxTextBudget.bullet),
  );
  const selectedChips = pickUnique(library.chipPool, 3, seed + 19).map((item) => shortText(item, 20));
  const callout = shortText(pickBySeed(library.calloutPool, seed, 13), maxTextBudget.callout);
  const metrics = library.metrics.map((metric) => ({
    label: shortText(metric.label, 18),
    value: shortText(metric.value, 32),
  })) as [NarrativeMetric, NarrativeMetric, NarrativeMetric];
  const fallbackBullet = "운영 방식은 기업별 도입 조건에 맞춰 조정 가능합니다.";
  const [bulletA, bulletB, bulletC] = [
    selectedBullets[0] ?? shortText(fallbackBullet, maxTextBudget.bullet),
    selectedBullets[1] ?? shortText(fallbackBullet, maxTextBudget.bullet),
    selectedBullets[2] ?? shortText(fallbackBullet, maxTextBudget.bullet),
  ] as const;
  const [chipA, chipB, chipC] = [
    selectedChips[0] ?? "맞춤 운영",
    selectedChips[1] ?? "전문가 검토",
    selectedChips[2] ?? "정기 공급",
  ] as const;
  const footer = shortText(
    `${title} | ${TEMPLATE_SPEC_LIBRARY[templateId].label} | ${pageNumber}페이지`,
    92,
  );

  return {
    kicker,
    title,
    subtitle,
    body,
    bullets: [bulletA, bulletB, bulletC],
    chips: [chipA, chipB, chipC],
    callout,
    footer,
    metrics,
  };
}

export function buildPageBrief(
  image: ScannedImage,
  pageNumber: number,
  imageIndex: number,
  forcedTemplateId?: PageTemplateId,
): PageBrief {
  const imageCaption = cleanCaptionFromFilename(image.filename);
  const category = detectCategory(image.filename);
  const picked = forcedTemplateId
    ? {
        templateId: forcedTemplateId,
        reason: "검증 게이트 실패로 안전 템플릿으로 폴백 적용",
      }
    : pickTemplateByImage(image, category, imageIndex);

  const templateSpec = getTemplateSpec(picked.templateId);
  const narrative = buildNarrative(
    category,
    image.filename,
    pageNumber,
    templateSpec.id,
    templateSpec.maxTextBudget,
  );

  return {
    sourceImage: image.filename,
    imageCaption,
    category,
    template: templateSpec.label,
    templateReason: picked.reason,
    readingFlow: templateSpec.readingFlow,
    maxTextBudget: templateSpec.maxTextBudget,
    templateId: templateSpec.id,
    fallbackTemplateId: templateSpec.fallbackTemplate,
    narrative,
  };
}
