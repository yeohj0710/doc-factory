import path from "node:path";
import type { ScannedImage } from "@/src/io/scanImages";

export type PageTemplate =
  | "cinematic-hero"
  | "editorial-spread"
  | "mosaic-notes"
  | "focus-rail"
  | "contrast-poster";

export type PageCategory =
  | "dispense"
  | "app"
  | "consult"
  | "report"
  | "package"
  | "generic";

export type NarrativeMetric = {
  label: string;
  value: string;
};

export type Narrative = {
  category: PageCategory;
  kicker: string;
  title: string;
  subtitle: string;
  summary: string;
  bullets: [string, string, string, string];
  chips: [string, string, string];
  callout: string;
  footer: string;
  metrics: [NarrativeMetric, NarrativeMetric, NarrativeMetric];
  panelLabels: [string, string];
};

type CategoryLibrary = {
  kickers: readonly string[];
  subtitles: readonly string[];
  intros: readonly string[];
  bullets: readonly string[];
  chips: readonly string[];
  callouts: readonly string[];
  metrics: readonly [NarrativeMetric, NarrativeMetric, NarrativeMetric];
};

const TEMPLATE_LABELS: Record<PageTemplate, string> = {
  "cinematic-hero": "임팩트 커버",
  "editorial-spread": "에디토리얼",
  "mosaic-notes": "모자이크",
  "focus-rail": "포커스 레일",
  "contrast-poster": "대비 포스터",
};

const LANDSCAPE_CYCLE: PageTemplate[] = [
  "cinematic-hero",
  "contrast-poster",
  "editorial-spread",
  "mosaic-notes",
  "focus-rail",
];

const PORTRAIT_CYCLE: PageTemplate[] = [
  "focus-rail",
  "editorial-spread",
  "cinematic-hero",
  "mosaic-notes",
  "contrast-poster",
];

const DEFAULT_CYCLE: PageTemplate[] = [
  "mosaic-notes",
  "cinematic-hero",
  "editorial-spread",
  "contrast-poster",
  "focus-rail",
];

const CATEGORY_LIBRARY: Record<PageCategory, CategoryLibrary> = {
  dispense: {
    kickers: ["1알 단위 소분 조제", "7일 맞춤 리밸런싱", "정밀 영양 설계 서비스"],
    subtitles: [
      "약국 1통 구매 대신 필요한 성분만 7일 단위로 제공합니다",
      "복용 반응을 빠르게 확인하고 다음 주기 조합을 다시 설계합니다",
      "개인 상태와 목표를 반영해 고정 처방이 아닌 유동 처방으로 운영합니다",
    ],
    intros: [
      "소분 조제 기반의 핵심 운영 모델을 보여주는 페이지입니다.",
      "개인별 조합을 유연하게 바꾸는 7일 사이클을 시각화했습니다.",
      "소량 시작과 빠른 피드백으로 복용 부담을 낮추는 구조입니다.",
    ],
    bullets: [
      "필요 성분만 선택해 불필요한 대용량 구매를 줄입니다",
      "최소 7일 단위로 조합을 재설계해 정밀도를 높입니다",
      "복용 순응도와 체감 변화를 다음 처방에 즉시 반영합니다",
      "약사 검토 기준을 반영해 안전성과 이해도를 확보합니다",
      "배송 주기를 고정해 운영팀과 고객 모두 예측 가능하게 관리합니다",
      "개인별 목표에 맞춘 조합 변경이 쉽습니다",
    ],
    chips: ["7일 주기", "소분 조제", "맞춤 배합", "정밀 관리"],
    callouts: [
      "핵심 가치: 고정 영양제가 아니라 반응에 따라 계속 맞춰지는 개인 처방 루프.",
      "1알 단위 운영으로 시작 장벽을 낮추고 조합 실험 속도를 높입니다.",
      "서비스 목표는 판매보다 개인 적합도 향상에 있습니다.",
    ],
    metrics: [
      { label: "제공 단위", value: "1알 소분" },
      { label: "조정 주기", value: "최소 7일" },
      { label: "운영 방식", value: "반응 기반 리밸런싱" },
    ],
  },
  app: {
    kickers: ["AI 추천 엔진", "모바일 문진 플로우", "데이터 기반 매칭"],
    subtitles: [
      "사용자 입력을 바탕으로 개인 적합 성분을 자동 추천합니다",
      "질문-분석-추천-배송까지 하나의 디지털 흐름으로 연결됩니다",
      "추천 이유를 함께 제시해 임직원 신뢰도를 높입니다",
    ],
    intros: [
      "AI 추천 서비스 경험을 빠르게 이해시키는 페이지입니다.",
      "설문 결과를 개인별 제안으로 전환하는 디지털 레이어를 담았습니다.",
      "쉽게 참여하고 재추천까지 이어지는 화면 흐름을 보여줍니다.",
    ],
    bullets: [
      "전문가 설계 문항으로 개인 상태를 구조화해 수집합니다",
      "AI가 생활 습관과 목표를 반영해 성분 우선순위를 계산합니다",
      "추천 결과는 배송 신청까지 즉시 연결됩니다",
      "추천 이유와 기대 포인트를 함께 제시해 수용성을 높입니다",
      "주기별 재문진으로 추천 정확도를 지속 개선합니다",
      "입력 부담을 낮춘 질문 구조로 참여율을 높입니다",
    ],
    chips: ["AI 추천", "설문 기반", "간편 신청", "지속 개선"],
    callouts: [
      "추천은 일회성 결과가 아니라 주기적으로 업데이트되는 개인 프로파일입니다.",
      "데이터 흐름을 단순화해 참여율과 전환율을 동시에 높입니다.",
      "앱 경험은 B2C와 B2B에 동일한 품질로 확장 가능합니다.",
    ],
    metrics: [
      { label: "추천 방식", value: "AI + 전문가 룰" },
      { label: "입력 채널", value: "모바일/웹 설문" },
      { label: "결과 연계", value: "추천 후 배송 신청" },
    ],
  },
  consult: {
    kickers: ["약사 DAY 상담", "전문가 최종 검토", "현장 밀착 케어"],
    subtitles: [
      "사전 설문과 약사 대면 상담을 결합해 최종 추천 정확도를 높입니다",
      "기업 방문 상담으로 임직원이 직접 질문하고 조정받을 수 있습니다",
      "문진 데이터와 상담 메모를 통합해 최종 배합안을 확정합니다",
    ],
    intros: [
      "B2B 현장 운영에서 설득력이 큰 상담 단계를 보여주는 페이지입니다.",
      "임직원 맞춤 추천이 어떻게 확정되는지 명확히 설명합니다.",
      "약사 전문성 기반의 안전한 의사결정 구조를 담았습니다.",
    ],
    bullets: [
      "사전 설문 결과를 바탕으로 상담 우선순위를 선별합니다",
      "약사님이 정기 방문해 복용 이력과 컨디션을 직접 점검합니다",
      "상담 결과는 즉시 분석에 반영되어 개인별 제안이 업데이트됩니다",
      "금기/주의 성분 확인으로 안전한 추천 기준을 유지합니다",
      "기업 담당자용 운영 리포트로 진행 상황을 공유합니다",
      "상담 이력 누적으로 다음 달 추천 품질이 향상됩니다",
    ],
    chips: ["약사 방문", "대면 상담", "안전 검토", "최종 확정"],
    callouts: [
      "AI 추천 위에 약사 판단을 더해 신뢰 가능한 최종안을 제공합니다.",
      "현장 상담은 참여율과 만족도를 동시에 끌어올리는 핵심 접점입니다.",
      "데이터와 전문가 판단을 결합해 오추천 리스크를 낮춥니다.",
    ],
    metrics: [
      { label: "상담 방식", value: "정기 방문/대면" },
      { label: "최종 추천", value: "약사 검토 반영" },
      { label: "운영 대상", value: "기업 임직원" },
    ],
  },
  report: {
    kickers: ["개인 건강 레포트", "월간 변화 추적", "피드백 기반 개선"],
    subtitles: [
      "개인 맞춤 건강 레포트로 변화 과정을 명확히 제공합니다",
      "복용·컨디션·상담 데이터를 묶어 월 단위로 결과를 공유합니다",
      "사후 피드백을 다음 추천 조합의 근거로 연결합니다",
    ],
    intros: [
      "패키지의 차별점인 사후 관리와 리포팅 단계를 설명하는 페이지입니다.",
      "성과를 지표와 코멘트로 전달해 이해하기 쉽게 구성했습니다.",
      "정기 레포트는 다음 달 처방의 핵심 입력값으로 활용됩니다.",
    ],
    bullets: [
      "개인별 변화 포인트를 한눈에 보는 맞춤 레포트를 제공합니다",
      "복용 반응과 생활 패턴 피드백을 다음 배합에 반영합니다",
      "월별 누적 데이터를 기반으로 개선 방향을 제안합니다",
      "정량 지표와 상담 코멘트를 함께 보여 실행력을 높입니다",
      "임직원과 기업 담당자 모두 이해할 수 있는 언어로 구성합니다",
      "사후 관리가 반복될수록 개인 적합도가 높아집니다",
    ],
    chips: ["개인 레포트", "월간 분석", "사후 피드백", "지속 개선"],
    callouts: [
      "이 서비스의 본질은 피드백을 통해 더 맞는 조합을 찾아가는 과정입니다.",
      "레포트는 결과 공유를 넘어 다음 추천 품질을 높이는 핵심 데이터입니다.",
      "고정 복용이 아니라 개인 맞춤 최적화 사이클을 운영합니다.",
    ],
    metrics: [
      { label: "레포트 주기", value: "월 1회" },
      { label: "피드백 반영", value: "다음 달 조합" },
      { label: "핵심 목표", value: "개인 적합도 향상" },
    ],
  },
  package: {
    kickers: ["B2B 임직원 패키지", "도입형 복지 프로그램", "진단-상담-배송 일체형"],
    subtitles: [
      "설문, 분석, 약사 상담, 소분 조제, 월 배송, 건강 레포트를 한 번에 제공합니다",
      "기업 규모와 일정에 맞춰 운영 가능한 임직원 건강 복지 패키지입니다",
      "도입 후에도 월별 재평가로 구성원 만족도를 지속 관리합니다",
    ],
    intros: [
      "기업 제안에 필요한 전체 패키지 구조를 압축해서 보여주는 페이지입니다.",
      "도입 결정자가 운영 범위와 기대효과를 빠르게 이해할 수 있습니다.",
      "일회성 이벤트가 아닌 월간 반복 운영 모델을 전달합니다.",
    ],
    bullets: [
      "사내 설문 배포부터 결과 수집·분석까지 대행 가능합니다",
      "약사 DAY 상담과 개인 맞춤 추천으로 임직원 만족도를 높입니다",
      "월 1회 한 달치 소분 제품을 기업 일정에 맞춰 전달합니다",
      "개인 건강 레포트 포함으로 사후 관리 체계를 완성합니다",
      "기업 담당자는 운영 현황과 참여 데이터를 주기적으로 확인할 수 있습니다",
      "복지 예산 안에서 유연한 플랜 구성이 가능합니다",
    ],
    chips: ["B2B 패키지", "월간 운영", "임직원 복지", "원스톱"],
    callouts: [
      "도입 포인트: 적은 초기 부담으로 시작해 데이터 기반으로 고도화합니다.",
      "추천에서 끝나지 않고 월별 실행과 피드백까지 책임집니다.",
      "기업은 운영 부담을 줄이고 임직원은 맞춤 케어를 경험합니다.",
    ],
    metrics: [
      { label: "제공 주기", value: "월 1회 배송" },
      { label: "구성 요소", value: "설문+상담+소분+레포트" },
      { label: "도입 형태", value: "기업 복지 계약" },
    ],
  },
  generic: {
    kickers: ["서비스 장면 요약", "핵심 운영 포인트", "소개서 기본 페이지"],
    subtitles: [
      "이미지와 핵심 문구를 함께 배치해 빠르게 이해를 돕습니다",
      "반복 편집이 쉬운 모듈형 구성으로 안정적인 소개서를 만듭니다",
      "A4 발표 환경에 맞춘 가독성 중심 레이아웃입니다",
    ],
    intros: [
      "기본 소개 프레임을 적용한 페이지입니다.",
      "빠른 검토와 편집을 위해 영역별 정보 밀도를 맞췄습니다.",
      "동일 입력에서 같은 결과가 나오도록 안정적으로 구성했습니다.",
    ],
    bullets: [
      "A4 기준 제목-본문 위계를 명확히 유지합니다",
      "이미지와 설명 카드가 함께 읽히도록 구획을 맞췄습니다",
      "장식 요소도 모두 PPTX에서 직접 수정할 수 있습니다",
      "반복 제작에도 레이아웃이 흔들리지 않도록 설계했습니다",
      "파일명 기반 캡션으로 입력 부담을 최소화합니다",
      "소개서 페이지를 빠르게 증감할 수 있습니다",
    ],
    chips: ["재사용", "안정 출력", "A4 최적화", "편집 가능"],
    callouts: [
      "모든 도형과 텍스트는 PPTX에서 직접 편집 가능합니다.",
      "입력 이미지가 바뀌어도 동일 규칙으로 안정적으로 재생성됩니다.",
      "영업 현장에서 바로 쓰고 바로 수정할 수 있는 구조를 제공합니다.",
    ],
    metrics: [
      { label: "출력 형식", value: "A4 PPTX" },
      { label: "편집 방식", value: "텍스트/도형 직접 수정" },
      { label: "입력 조건", value: "/images 만으로 생성" },
    ],
  },
};

function shortText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function toTitleCase(value: string): string {
  if (/[가-힣]/.test(value)) {
    return value;
  }
  return value
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}

function cleanCaptionFromFilename(filename: string): string {
  const stem = path.parse(filename).name;
  const withoutPrefix = stem.replace(
    /^\s*(?:\(\s*\d+\s*\)|p\s*\d+|\d+)(?:[\s._-]+)?/i,
    "",
  );

  const normalized = withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length > 0) {
    return normalized;
  }

  const fallback = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return fallback || "제목 없음 이미지";
}

function normalizeForKeywordMatch(filename: string): string {
  return path
    .parse(filename)
    .name.toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function includesAnyKeyword(normalized: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => normalized.includes(keyword));
}

export function detectCategory(filename: string): PageCategory {
  const normalized = normalizeForKeywordMatch(filename);
  const consultKeywords = ["약사", "상담", "consult", "advisor", "pharmacist", "clinic"] as const;
  const reportKeywords = ["레포트", "리포트", "보고서", "report", "summary", "insight"] as const;
  const packageKeywords = ["패키지", "기업", "임직원", "복지", "b2b", "package", "bundle", "program"] as const;
  const appKeywords = ["앱", "웹", "화면", "추천", "ai", "app", "mobile", "web", "screen"] as const;
  const dispenseKeywords = ["소분", "분할", "조제", "건기식", "영양제", "dispense", "dose", "formula", "pill"] as const;

  if (includesAnyKeyword(normalized, consultKeywords)) {
    return "consult";
  }
  if (includesAnyKeyword(normalized, reportKeywords)) {
    return "report";
  }
  if (includesAnyKeyword(normalized, packageKeywords)) {
    return "package";
  }
  if (includesAnyKeyword(normalized, appKeywords)) {
    return "app";
  }
  if (includesAnyKeyword(normalized, dispenseKeywords)) {
    return "dispense";
  }

  return "generic";
}

function pickTemplateFromCycle(cycle: readonly PageTemplate[], index: number): PageTemplate {
  return cycle[index % cycle.length];
}

export function pickTemplate(image: ScannedImage, index: number): PageTemplate {
  const width = image.widthPx ?? 1;
  const height = image.heightPx ?? 1;
  const ratio = width / height;

  if (ratio >= 1.2) {
    return pickTemplateFromCycle(LANDSCAPE_CYCLE, index);
  }
  if (ratio <= 0.85) {
    return pickTemplateFromCycle(PORTRAIT_CYCLE, index);
  }

  return pickTemplateFromCycle(DEFAULT_CYCLE, index);
}

function pickBySeed<T>(values: readonly T[], seed: number, offset = 0): T {
  return values[(seed + offset) % values.length];
}

function pickUnique(values: readonly string[], count: number, seed: number): string[] {
  if (values.length === 0) {
    return [];
  }

  const results: string[] = [];
  let cursor = seed % values.length;

  while (results.length < count) {
    const candidate = values[cursor];
    if (!results.includes(candidate)) {
      results.push(candidate);
    }

    cursor = (cursor + 1) % values.length;
    if (results.length === values.length) {
      break;
    }
  }

  return results;
}

function describeAspect(image: ScannedImage): string {
  if (!image.widthPx || !image.heightPx) {
    return "미확인";
  }

  const ratio = image.widthPx / image.heightPx;
  const shape = ratio > 1.15 ? "가로형" : ratio < 0.88 ? "세로형" : "균형형";
  return `${shape} ${ratio.toFixed(2)}:1`;
}

function describeResolution(image: ScannedImage): string {
  if (!image.widthPx || !image.heightPx) {
    return "미확인";
  }
  return `${image.widthPx}x${image.heightPx}px`;
}

function buildPanelLabels(chips: readonly string[], seed: number): [string, string] {
  const left = pickBySeed(chips, seed, 0);
  const right = pickBySeed(chips, seed, 1);
  if (left === right) {
    return [left, pickBySeed(chips, seed, 2)];
  }
  return [left, right];
}

function buildMetrics(
  category: PageCategory,
  image: ScannedImage,
  template: PageTemplate,
  library: CategoryLibrary,
): [NarrativeMetric, NarrativeMetric, NarrativeMetric] {
  if (category === "generic") {
    return [
      {
        label: "비율",
        value: describeAspect(image),
      },
      {
        label: "해상도",
        value: describeResolution(image),
      },
      {
        label: "템플릿",
        value: TEMPLATE_LABELS[template],
      },
    ];
  }

  const [metricA, metricB, metricC] = library.metrics;
  return [
    {
      label: shortText(metricA.label, 18),
      value: shortText(metricA.value, 34),
    },
    {
      label: shortText(metricB.label, 18),
      value: shortText(metricB.value, 34),
    },
    {
      label: shortText(metricC.label, 18),
      value: shortText(metricC.value, 34),
    },
  ];
}

export function buildNarrative(
  image: ScannedImage,
  pageNumber: number,
  template: PageTemplate,
  categoryIndex: number,
): Narrative {
  const caption = cleanCaptionFromFilename(image.filename);
  const category = detectCategory(image.filename);
  const library = CATEGORY_LIBRARY[category];
  const seed = stableHash(`${image.filename}|${pageNumber}|${template}|${categoryIndex}`);
  const cleanedTitle = toTitleCase(caption);
  const title = shortText(cleanedTitle, 44);
  const subtitle = shortText(pickBySeed(library.subtitles, seed, 3), 78);
  const intro = pickBySeed(library.intros, seed, 7);
  const summary = shortText(`${intro} 핵심 장면: ${shortText(title, 22)}.`, 98);
  const selectedBullets = pickUnique(library.bullets, 4, seed + 11);
  const selectedChips = pickUnique(library.chips, 3, seed + 19);
  const [chipA, chipB, chipC] = [
    selectedChips[0] ?? library.chips[0] ?? "편집 가능",
    selectedChips[1] ?? library.chips[1] ?? "안정 구조",
    selectedChips[2] ?? library.chips[2] ?? "재사용 가능",
  ] as const;
  const [bulletA, bulletB, bulletC, bulletD] = [
    shortText(selectedBullets[0] ?? library.bullets[0] ?? "핵심 내용을 구조화해 전달합니다", 42),
    shortText(selectedBullets[1] ?? library.bullets[1] ?? "A4 가독성 기준을 유지합니다", 42),
    shortText(selectedBullets[2] ?? library.bullets[2] ?? "PPTX에서 즉시 수정할 수 있습니다", 42),
    shortText(selectedBullets[3] ?? library.bullets[3] ?? "반복 제작에도 결과가 안정적입니다", 42),
  ] as const;
  const callout = shortText(pickBySeed(library.callouts, seed, 13), 98);
  const panelLabels = buildPanelLabels([chipA, chipB, chipC], seed);
  const metrics = buildMetrics(category, image, template, library);

  return {
    category,
    kicker: pickBySeed(library.kickers, seed, 1),
    title,
    subtitle,
    summary,
    bullets: [bulletA, bulletB, bulletC, bulletD],
    chips: [chipA, chipB, chipC],
    callout,
    footer: `${shortText(title, 24)} | ${TEMPLATE_LABELS[template]} | ${pageNumber}페이지`,
    metrics,
    panelLabels,
  };
}
