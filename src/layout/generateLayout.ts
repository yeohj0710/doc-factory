import path from "node:path";
import type { ScannedImage } from "@/src/io/scanImages";
import type { LayoutTokens } from "@/src/layout/tokens";
import {
  PAGE_SIZE_A4_PORTRAIT,
  type Element,
  type ImageElement,
  type PageLayout,
} from "@/src/layout/types";

type TemplateKey =
  | "hero-ribbon"
  | "editorial-split"
  | "insight-grid"
  | "framed-focus"
  | "dual-panels";

type PageCategory =
  | "dispense"
  | "app"
  | "consult"
  | "report"
  | "package"
  | "generic";

type MetricCard = {
  label: string;
  value: string;
};

type StoryDefinition = {
  template: TemplateKey;
  kicker: string;
  title: string;
  summary: string;
  bulletsA: [string, string, string];
  bulletsB: [string, string, string];
  callout: string;
  footer: string;
  metrics: [MetricCard, MetricCard, MetricCard];
  panelLabels: [string, string];
};

type Narrative = {
  kicker: string;
  title: string;
  summary: string;
  bulletsA: [string, string, string];
  bulletsB: [string, string, string];
  callout: string;
  footer: string;
  metrics: [MetricCard, MetricCard, MetricCard];
  panelLabels: [string, string];
};

const PAGE_W = PAGE_SIZE_A4_PORTRAIT.widthMm;
const PAGE_H = PAGE_SIZE_A4_PORTRAIT.heightMm;

const DEFAULT_CYCLE: TemplateKey[] = [
  "hero-ribbon",
  "editorial-split",
  "insight-grid",
  "framed-focus",
  "dual-panels",
];

const LANDSCAPE_CYCLE: TemplateKey[] = [
  "hero-ribbon",
  "insight-grid",
  "dual-panels",
  "editorial-split",
  "framed-focus",
];

const PORTRAIT_CYCLE: TemplateKey[] = [
  "editorial-split",
  "framed-focus",
  "hero-ribbon",
  "dual-panels",
  "insight-grid",
];

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length];
}

function shortText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function bullets(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
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
  return fallback || "Untitled image";
}

function normalizeFilenameForMatch(filename: string): string {
  return path.parse(filename).name.toLowerCase().replace(/\s+/g, "");
}

function detectCategory(filename: string): PageCategory {
  const normalized = normalizeFilenameForMatch(filename);

  if (
    normalized.includes("약사") ||
    normalized.includes("consult") ||
    normalized.includes("pharmacist")
  ) {
    return "consult";
  }
  if (normalized.includes("레포트") || normalized.includes("report")) {
    return "report";
  }
  if (normalized.includes("패키지") || normalized.includes("package")) {
    return "package";
  }
  if (
    normalized.includes("앱") ||
    normalized.includes("mobile") ||
    normalized.includes("web")
  ) {
    return "app";
  }
  if (
    normalized.includes("소분") ||
    normalized.includes("dispense") ||
    normalized.includes("분할")
  ) {
    return "dispense";
  }
  return "generic";
}

function fallbackTemplate(image: ScannedImage, index: number): TemplateKey {
  const width = image.widthPx ?? 1;
  const height = image.heightPx ?? 1;
  const ratio = width / height;
  if (ratio >= 1.2) {
    return LANDSCAPE_CYCLE[index % LANDSCAPE_CYCLE.length];
  }
  if (ratio <= 0.85) {
    return PORTRAIT_CYCLE[index % PORTRAIT_CYCLE.length];
  }
  return DEFAULT_CYCLE[index % DEFAULT_CYCLE.length];
}

function buildStoryDefinition(
  category: PageCategory,
  categoryIndex: number,
  caption: string,
  defaultTemplate: TemplateKey,
): StoryDefinition {
  if (category === "dispense") {
    if (categoryIndex === 0) {
      return {
        template: "hero-ribbon",
        kicker: "SERVICE CORE",
        title: "약국 기반 1알 소분조제",
        summary: "건기식을 1통이 아닌 1알 단위로 조합해 개인별 맞춤 구성으로 제공합니다.",
        bulletsA: ["필요 성분 중심 맞춤 배합", "약국 네트워크 기반 조제", "불필요한 구매 부담 완화"],
        bulletsB: ["최소 7일 단위 소분 판매", "복용 편의 높은 파우치", "조제와 배송을 통합 운영"],
        callout: "기업 복지에 바로 적용 가능한 개인 맞춤 소분 인프라",
        footer: "웰니스박스 핵심 서비스",
        metrics: [
          { label: "판매 단위", value: "최소 7일" },
          { label: "조제 방식", value: "1알 단위" },
          { label: "운영 채널", value: "약국 기반" },
        ],
        panelLabels: ["소분 조제", "복용 편의"],
      };
    }

    if (categoryIndex === 1) {
      return {
        template: "insight-grid",
        kicker: "PRECISION CYCLE",
        title: "7일 단위 리밸런싱",
        summary: "7일마다 조합을 바꿀 수 있어 고정 처방보다 빠르게 반응을 반영합니다.",
        bulletsA: ["사용자 반응을 주 단위 확인", "생활 패턴 변화 신속 반영", "조합 미세 조정이 용이"],
        bulletsB: ["불필요 성분 즉시 제외", "맞춤 정확도 지속 향상", "장기 복용 피로도 완화"],
        callout: "한 번의 처방이 아니라 계속 맞춰가는 맞춤 여정",
        footer: "정밀 맞춤 운영",
        metrics: [
          { label: "조정 주기", value: "7일" },
          { label: "반영 속도", value: "주 단위" },
          { label: "운영 방식", value: "지속 업데이트" },
        ],
        panelLabels: ["7일 운영", "정밀 조합"],
      };
    }

    if (categoryIndex === 2) {
      return {
        template: "dual-panels",
        kicker: "B2B DELIVERY",
        title: "임직원별 월 1회 한 달치 공급",
        summary: "개인별 최종 추천 성분을 소분조제해 기업 현장으로 월 1회 정기 배송합니다.",
        bulletsA: ["임직원별 전용 성분 구성", "월간 운영 일정 표준화", "복지팀 관리 부담 최소화"],
        bulletsB: ["재추천과 재조합 연동", "배포/복용 일정 관리 용이", "프로그램 확장성 확보"],
        callout: "기업은 운영 효율, 임직원은 개인 맞춤 경험을 확보합니다.",
        footer: "기업 전용 정기 배송",
        metrics: [
          { label: "공급 주기", value: "월 1회" },
          { label: "공급 단위", value: "한 달치" },
          { label: "대상", value: "임직원 맞춤" },
        ],
        panelLabels: ["개인 배합", "정기 배송"],
      };
    }

    return {
      template: "framed-focus",
      kicker: "FEEDBACK LOOP",
      title: "사후 피드백 기반 지속 고도화",
      summary: "복용 이후 체감과 상담 내용을 반영해 다음 회차 조합을 재설계합니다.",
      bulletsA: ["복용 체감과 순응도 점검", "약사 코멘트 정기 반영", "다음 회차 조합 업데이트"],
      bulletsB: ["고정 성분 복용을 지양", "개인별 최적 조합 탐색", "장기 만족도와 신뢰도 향상"],
      callout: "아무거나 고정 복용이 아닌, 나에게 맞는 조합을 찾아가는 과정",
      footer: "지속 개선 루프",
      metrics: [
        { label: "피드백 소스", value: "체감 + 상담" },
        { label: "업데이트", value: "회차별 재배합" },
        { label: "기대 효과", value: "정확도 고도화" },
      ],
      panelLabels: ["피드백 수집", "조합 고도화"],
    };
  }

  if (category === "app") {
    return {
      template: "editorial-split",
      kicker: "AI RECOMMENDATION",
      title: "AI 기반 맞춤 건기식 추천",
      summary: "전문가 설계 설문과 건강 정보를 바탕으로 개인 맞춤 성분 조합을 제안합니다.",
      bulletsA: ["자체 설계 설문으로 입력 수집", "AI가 우선 성분군을 도출", "추천 결과를 즉시 확인"],
      bulletsB: ["모바일/웹 채널로 접근", "추천부터 배송 신청까지 연결", "임직원 참여 장벽 최소화"],
      callout: "디지털 추천과 실제 조제·배송이 하나의 흐름으로 연결됩니다.",
      footer: "AI 추천 서비스",
      metrics: [
        { label: "입력 데이터", value: "설문 + 생활 정보" },
        { label: "추천 엔진", value: "AI 기반" },
        { label: "접점", value: "모바일 + 웹" },
      ],
      panelLabels: ["모바일", "웹"],
    };
  }

  if (category === "consult") {
    return {
      template: "editorial-split",
      kicker: "PHARMACIST DAY",
      title: "약사 방문 상담으로 최종 확정",
      summary: "설문 분석 결과에 약사 Day 현장 상담을 더해 임직원별 최종 추천안을 확정합니다.",
      bulletsA: ["사전 설문 결과 해석", "복용 이력과 생활 습관 확인", "성분 간 상호작용 점검"],
      bulletsB: ["AI 추천과 전문가 판단 결합", "임직원 신뢰도와 만족도 향상", "실행 가능한 복용 계획 수립"],
      callout: "데이터 기반 추천에 전문 상담을 더해 실행력을 높입니다.",
      footer: "약사 Day 운영",
      metrics: [
        { label: "상담 형태", value: "현장 방문" },
        { label: "검토 기준", value: "설문 + 상담" },
        { label: "산출물", value: "개인별 최종 조합" },
      ],
      panelLabels: ["상담 전", "상담 후"],
    };
  }

  if (category === "report") {
    return {
      template: "framed-focus",
      kicker: "PERSONAL REPORT",
      title: "개인 맞춤 건강 리포트",
      summary: "우선 관리 영역, 핵심 성분, 복용 가이드를 통합 제공해 실행력을 높입니다.",
      bulletsA: ["개인별 건강 지표를 시각화", "부족 성분과 우선순위 요약", "복용 시간/방법 가이드 제공"],
      bulletsB: ["상담 결과를 쉽게 해석", "프로그램 신뢰도 강화", "다음 회차 피드백 기준 확보"],
      callout: "리포트는 단순 결과지가 아니라 행동 변화 가이드입니다.",
      footer: "맞춤 건강 리포트",
      metrics: [
        { label: "리포트 주기", value: "월간 제공" },
        { label: "핵심 항목", value: "지표 + 성분 + 가이드" },
        { label: "활용 방식", value: "피드백 기반 재추천" },
      ],
      panelLabels: ["개인 결과", "복용 가이드"],
    };
  }

  if (category === "package") {
    return {
      template: "hero-ribbon",
      kicker: "B2B PACKAGE",
      title: "추천·상담·소분·리포트 통합",
      summary: "진단부터 배송, 사후 피드백까지 전 과정을 하나의 기업 패키지로 제공합니다.",
      bulletsA: ["임직원 대상 사전 설문 배포", "결과 분석 및 약사 Day 상담", "개인별 성분 소분조제"],
      bulletsB: ["월 1회 한 달치 정기 배송", "개인 맞춤 건강 리포트 제공", "사후 피드백 기반 재추천"],
      callout: "도입 즉시 실행 가능한 End-to-End 임직원 건강복지 모델",
      footer: "기업 패키지 제안",
      metrics: [
        { label: "계약 모델", value: "B2B 전용" },
        { label: "운영 범위", value: "진단~배송~리포트" },
        { label: "도입 효과", value: "복지 차별화" },
      ],
      panelLabels: ["서비스 패키지", "도입 효과"],
    };
  }

  const genericStories: StoryDefinition[] = [
    {
      template: defaultTemplate,
      kicker: "B2B WELLNESS",
      title: "기업 맞춤 건강복지 제안",
      summary: "임직원 특성에 맞는 정밀 영양 설계로 참여율과 체감도를 높이는 복지 모델입니다.",
      bulletsA: ["맞춤 추천으로 참여 장벽 완화", "전문가 상담으로 신뢰 확보", "정기 배송으로 운영 표준화"],
      bulletsB: ["리포트 기반 후속 커뮤니케이션", "데이터 기반 프로그램 개선", "기업별 정책 맞춤 운영"],
      callout: "단발성 이벤트가 아닌 지속 가능한 임직원 건강복지 운영 체계",
      footer: "기업 건강복지",
      metrics: [
        { label: "운영 모델", value: "지속형 프로그램" },
        { label: "서비스 축", value: "추천 + 상담 + 배송" },
        { label: "성과 방향", value: "참여/만족 향상" },
      ],
      panelLabels: ["운영 모델", "성과 방향"],
    },
    {
      template: defaultTemplate,
      kicker: "IMPLEMENTATION",
      title: "도입 프로세스는 간단하게",
      summary: "도입 준비부터 정기 운영까지 표준 흐름으로 설계해 실행 부담을 낮춥니다.",
      bulletsA: ["대상자/일정 사전 확정", "설문 배포 및 데이터 수집", "현장 상담과 배합 확정"],
      bulletsB: ["월간 배송과 복용 가이드", "피드백 수집 후 재추천", "다음 회차 운영 리포트 공유"],
      callout: "복지팀이 쉽게 관리할 수 있는 운영 중심 구조",
      footer: "도입 프로세스",
      metrics: [
        { label: "준비 기간", value: "단기 셋업" },
        { label: "운영 리듬", value: "월간 사이클" },
        { label: "관리 포인트", value: "표준 프로세스" },
      ],
      panelLabels: ["도입 단계", "운영 단계"],
    },
  ];

  return {
    ...pick(genericStories, categoryIndex),
    title: shortText(caption, 34),
  };
}

function buildNarrative(story: StoryDefinition, caption: string): Narrative {
  return {
    kicker: story.kicker,
    title: shortText(story.title, 58),
    summary: shortText(story.summary, 140),
    bulletsA: [
      shortText(story.bulletsA[0], 28),
      shortText(story.bulletsA[1], 28),
      shortText(story.bulletsA[2], 28),
    ],
    bulletsB: [
      shortText(story.bulletsB[0], 28),
      shortText(story.bulletsB[1], 28),
      shortText(story.bulletsB[2], 28),
    ],
    callout: shortText(story.callout, 140),
    footer: `${story.footer} | ${shortText(caption, 32)}`,
    metrics: story.metrics,
    panelLabels: story.panelLabels,
  };
}

type ImageFrame = {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  fit: "cover" | "contain";
};

function imageElement(image: ScannedImage, frame: ImageFrame): ImageElement {
  return {
    type: "image",
    xMm: frame.xMm,
    yMm: frame.yMm,
    wMm: frame.wMm,
    hMm: frame.hMm,
    srcPublicPath: image.publicPath,
    fit: frame.fit,
    intrinsicWidthPx: image.widthPx,
    intrinsicHeightPx: image.heightPx,
    anchorX: 0.5,
    anchorY: 0.5,
  };
}

function addPageFooter(elements: Element[], narrative: Narrative, tokens: LayoutTokens): void {
  const margin = tokens.spacingMm.pageMargin;
  elements.push(
    {
      type: "line",
      x1Mm: margin,
      y1Mm: 282,
      x2Mm: PAGE_W - margin,
      y2Mm: 282,
      stroke: tokens.colors.border,
      widthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin,
      yMm: 285,
      wMm: PAGE_W - margin * 2,
      hMm: 8,
      text: narrative.footer,
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.mutedText,
    },
  );
}

function buildHeroRibbon(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const metricX = 146;
  const metricW = PAGE_W - metricX - margin;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: 86, fill: tokens.colors.softAccentAlt },
    { type: "rect", xMm: 0, yMm: 0, wMm: 8, hMm: 86, fill: tokens.colors.accent },
    {
      type: "text",
      xMm: margin + 2,
      yMm: 10,
      wMm: 130,
      hMm: 8,
      text: narrative.kicker,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.accentDeep,
    },
    {
      type: "text",
      xMm: margin + 2,
      yMm: 20,
      wMm: 130,
      hMm: 28,
      text: narrative.title,
      fontSizePt: tokens.fontScalePt.title,
      bold: true,
      color: tokens.colors.text,
    },
    {
      type: "text",
      xMm: margin + 2,
      yMm: 56,
      wMm: 132,
      hMm: 18,
      text: narrative.summary,
      fontSizePt: tokens.fontScalePt.body,
      color: tokens.colors.mutedText,
    },
  ];

  narrative.metrics.forEach((metric, index) => {
    const y = 12 + index * 24;
    elements.push(
      {
        type: "rect",
        xMm: metricX,
        yMm: y,
        wMm: metricW,
        hMm: 20,
        fill: tokens.colors.page,
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.3,
      },
      {
        type: "text",
        xMm: metricX + 4,
        yMm: y + 4,
        wMm: metricW - 8,
        hMm: 6,
        text: metric.label,
        fontSizePt: tokens.fontScalePt.micro,
        bold: true,
        color: tokens.colors.mutedText,
      },
      {
        type: "text",
        xMm: metricX + 4,
        yMm: y + 9,
        wMm: metricW - 8,
        hMm: 8,
        text: metric.value,
        fontSizePt: tokens.fontScalePt.caption,
        bold: true,
        color: tokens.colors.accentDeep,
      },
    );
  });

  elements.push(
    imageElement(image, { xMm: margin, yMm: 92, wMm: PAGE_W - margin * 2, hMm: 132, fit: "cover" }),
    { type: "rect", xMm: margin, yMm: 194, wMm: PAGE_W - margin * 2, hMm: 22, fill: tokens.colors.accentDeep },
    {
      type: "text",
      xMm: margin + 5,
      yMm: 200,
      wMm: PAGE_W - margin * 2 - 10,
      hMm: 12,
      text: narrative.callout,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.inverseText,
    },
    {
      type: "rect",
      xMm: margin,
      yMm: 230,
      wMm: PAGE_W - margin * 2,
      hMm: 40,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.md,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin + 5,
      yMm: 236,
      wMm: PAGE_W - margin * 2 - 10,
      hMm: 30,
      text: bullets(narrative.bulletsA),
      fontSizePt: tokens.fontScalePt.caption,
      color: tokens.colors.text,
    },
  );
  addPageFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildEditorialSplit(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const gutter = tokens.spacingMm.gutter;
  const leftW = 78;
  const rightX = margin + leftW + gutter;
  const rightW = PAGE_W - margin - rightX;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: margin, yMm: margin, wMm: leftW, hMm: PAGE_H - margin * 2, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.md },
    { type: "rect", xMm: margin, yMm: margin, wMm: 4, hMm: PAGE_H - margin * 2, fill: tokens.colors.accent, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 7, yMm: 17, wMm: leftW - 11, hMm: 8, text: narrative.kicker, fontSizePt: tokens.fontScalePt.micro, bold: true, color: tokens.colors.accentDeep },
    { type: "text", xMm: margin + 7, yMm: 28, wMm: leftW - 11, hMm: 32, text: narrative.title, fontSizePt: tokens.fontScalePt.subtitle, bold: true, color: tokens.colors.text },
    { type: "text", xMm: margin + 7, yMm: 62, wMm: leftW - 11, hMm: 24, text: narrative.summary, fontSizePt: tokens.fontScalePt.caption, color: tokens.colors.mutedText },
    { type: "rect", xMm: margin + 7, yMm: 98, wMm: leftW - 14, hMm: 44, fill: tokens.colors.page, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
    { type: "text", xMm: margin + 11, yMm: 104, wMm: leftW - 22, hMm: 34, text: bullets(narrative.bulletsA), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    { type: "rect", xMm: margin + 7, yMm: 149, wMm: leftW - 14, hMm: 38, fill: tokens.colors.page, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
    { type: "text", xMm: margin + 11, yMm: 155, wMm: leftW - 22, hMm: 28, text: bullets(narrative.bulletsB.slice(0, 2)), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    { type: "rect", xMm: margin + 7, yMm: 194, wMm: leftW - 14, hMm: 83, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 11, yMm: 201, wMm: leftW - 22, hMm: 70, text: narrative.callout, fontSizePt: tokens.fontScalePt.caption, color: tokens.colors.inverseText },
    { type: "rect", xMm: rightX, yMm: margin, wMm: rightW, hMm: 174, fill: tokens.colors.softAccentAlt, radiusMm: tokens.radiusMm.md },
    imageElement(image, { xMm: rightX + 2, yMm: margin + 2, wMm: rightW - 4, hMm: 170, fit: "cover" }),
    { type: "rect", xMm: rightX, yMm: 188, wMm: rightW, hMm: 54, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: rightX + 5, yMm: 194, wMm: rightW - 10, hMm: 42, text: shortText(narrative.summary, 130), fontSizePt: tokens.fontScalePt.body, bold: true, color: tokens.colors.inverseText },
  ];

  const cardW = (rightW - 4) / 3;
  narrative.metrics.forEach((metric, index) => {
    const x = rightX + index * (cardW + 2);
    elements.push(
      { type: "rect", xMm: x, yMm: 248, wMm: cardW, hMm: 28, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
      { type: "text", xMm: x + 3, yMm: 254, wMm: cardW - 6, hMm: 18, text: `${metric.label}\n${metric.value}`, fontSizePt: tokens.fontScalePt.micro, bold: true, align: "center", color: tokens.colors.text },
    );
  });

  addPageFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildInsightGrid(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const cardGap = 4;
  const width = PAGE_W - margin * 2;
  const cardW = (width - cardGap * 2) / 3;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    imageElement(image, { xMm: margin, yMm: margin, wMm: width, hMm: 108, fit: "cover" }),
    { type: "rect", xMm: margin, yMm: 122, wMm: width, hMm: 33, fill: tokens.colors.softAccentAlt, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 4, yMm: 127, wMm: width - 8, hMm: 7, text: narrative.kicker, fontSizePt: tokens.fontScalePt.micro, bold: true, color: tokens.colors.accentDeep },
    { type: "text", xMm: margin + 4, yMm: 134, wMm: width - 8, hMm: 16, text: narrative.title, fontSizePt: tokens.fontScalePt.lead, bold: true, color: tokens.colors.text },
    { type: "rect", xMm: margin, yMm: 220, wMm: width, hMm: 26, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 5, yMm: 227, wMm: width - 10, hMm: 14, text: narrative.callout, fontSizePt: tokens.fontScalePt.caption, bold: true, color: tokens.colors.inverseText },
    { type: "rect", xMm: margin, yMm: 251, wMm: 92, hMm: 26, fill: tokens.colors.page, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
    { type: "rect", xMm: margin + 98, yMm: 251, wMm: 92, hMm: 26, fill: tokens.colors.page, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
    { type: "text", xMm: margin + 4, yMm: 257, wMm: 84, hMm: 16, text: `${narrative.metrics[0].label}: ${narrative.metrics[0].value}\n${narrative.metrics[1].label}: ${narrative.metrics[1].value}`, fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    { type: "text", xMm: margin + 102, yMm: 257, wMm: 84, hMm: 16, text: `${narrative.metrics[2].label}: ${narrative.metrics[2].value}\n${narrative.kicker}`, fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
  ];

  const cardLines = [
    [narrative.bulletsA[0], narrative.bulletsA[1]],
    [narrative.bulletsA[2], narrative.bulletsB[0]],
    [narrative.bulletsB[1], narrative.bulletsB[2]],
  ];
  cardLines.forEach((lines, index) => {
    const x = margin + index * (cardW + cardGap);
    elements.push(
      { type: "rect", xMm: x, yMm: 161, wMm: cardW, hMm: 53, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
      { type: "text", xMm: x + 3, yMm: 167, wMm: cardW - 6, hMm: 43, text: bullets(lines), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    );
  });

  addPageFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildFramedFocus(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const railW = 46;
  const frameX = 62;
  const frameY = 40;
  const frameW = 98;
  const frameH = 172;
  const rightX = 166;
  const rightW = PAGE_W - margin - rightX;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: margin, yMm: margin, wMm: railW, hMm: PAGE_H - margin * 2, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.md },
    { type: "text", xMm: margin + 4, yMm: 18, wMm: railW - 8, hMm: 8, text: narrative.kicker, fontSizePt: tokens.fontScalePt.micro, bold: true, color: tokens.colors.accentDeep },
    { type: "text", xMm: margin + 4, yMm: 29, wMm: railW - 8, hMm: 35, text: shortText(narrative.title, 28), fontSizePt: tokens.fontScalePt.caption, bold: true, color: tokens.colors.text },
    { type: "text", xMm: margin + 4, yMm: 70, wMm: railW - 8, hMm: 58, text: bullets(narrative.bulletsA), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.mutedText },
    { type: "rect", xMm: margin + 4, yMm: 210, wMm: railW - 8, hMm: 67, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 7, yMm: 216, wMm: railW - 14, hMm: 54, text: shortText(narrative.callout, 120), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.inverseText },
    { type: "rect", xMm: frameX - 4, yMm: frameY - 4, wMm: frameW + 8, hMm: frameH + 8, fill: tokens.colors.softAccentAlt, radiusMm: tokens.radiusMm.lg },
    { type: "rect", xMm: frameX - 1, yMm: frameY - 1, wMm: frameW + 2, hMm: frameH + 2, fill: tokens.colors.page, radiusMm: tokens.radiusMm.md, stroke: tokens.colors.border, strokeWidthMm: 0.35 },
    imageElement(image, { xMm: frameX, yMm: frameY, wMm: frameW, hMm: frameH, fit: "cover" }),
    { type: "rect", xMm: frameX, yMm: frameY + frameH - 28, wMm: frameW, hMm: 22, fill: tokens.colors.accentDeep },
    { type: "text", xMm: frameX + 4, yMm: frameY + frameH - 22, wMm: frameW - 8, hMm: 12, text: shortText(narrative.summary, 90), fontSizePt: tokens.fontScalePt.micro, bold: true, color: tokens.colors.inverseText },
    { type: "rect", xMm: frameX, yMm: 220, wMm: frameW, hMm: 57, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
    { type: "text", xMm: frameX + 4, yMm: 226, wMm: frameW - 8, hMm: 47, text: bullets(narrative.bulletsB), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    { type: "rect", xMm: rightX, yMm: 156, wMm: rightW, hMm: 121, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: rightX + 3, yMm: 163, wMm: rightW - 6, hMm: 108, text: bullets(narrative.bulletsA.concat(narrative.bulletsB)), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.inverseText },
  ];

  narrative.metrics.forEach((metric, index) => {
    const y = 40 + index * 38;
    elements.push(
      { type: "rect", xMm: rightX, yMm: y, wMm: rightW, hMm: 32, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
      { type: "text", xMm: rightX + 3, yMm: y + 9, wMm: rightW - 6, hMm: 18, text: `${metric.label}\n${metric.value}`, fontSizePt: tokens.fontScalePt.micro, bold: true, align: "center", color: tokens.colors.text },
    );
  });

  addPageFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildDualPanels(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const panelGap = 6;
  const panelW = (PAGE_W - margin * 2 - panelGap) / 2;
  const panelY = 44;
  const panelH = 112;
  const cardGap = 4;
  const cardW = (PAGE_W - margin * 2 - cardGap * 2) / 3;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: 34, fill: tokens.colors.softAccentAlt },
    { type: "text", xMm: margin, yMm: 8, wMm: PAGE_W - margin * 2, hMm: 8, text: narrative.kicker, fontSizePt: tokens.fontScalePt.micro, bold: true, color: tokens.colors.accentDeep },
    { type: "text", xMm: margin, yMm: 16, wMm: PAGE_W - margin * 2, hMm: 14, text: narrative.title, fontSizePt: tokens.fontScalePt.subtitle, bold: true, color: tokens.colors.text },
    { type: "rect", xMm: margin, yMm: panelY, wMm: panelW, hMm: panelH, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.md },
    { type: "rect", xMm: margin + panelW + panelGap, yMm: panelY, wMm: panelW, hMm: panelH, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.md },
    imageElement(image, { xMm: margin + 2, yMm: panelY + 2, wMm: panelW - 4, hMm: panelH - 4, fit: "cover" }),
    imageElement(image, { xMm: margin + panelW + panelGap + 2, yMm: panelY + 2, wMm: panelW - 4, hMm: panelH - 4, fit: "contain" }),
    { type: "rect", xMm: margin + 6, yMm: panelY + 6, wMm: 34, hMm: 10, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 8, yMm: panelY + 9, wMm: 30, hMm: 6, text: shortText(narrative.panelLabels[0], 12), fontSizePt: tokens.fontScalePt.micro, bold: true, align: "center", color: tokens.colors.inverseText },
    { type: "rect", xMm: margin + panelW + panelGap + 6, yMm: panelY + 6, wMm: 34, hMm: 10, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + panelW + panelGap + 8, yMm: panelY + 9, wMm: 30, hMm: 6, text: shortText(narrative.panelLabels[1], 12), fontSizePt: tokens.fontScalePt.micro, bold: true, align: "center", color: tokens.colors.inverseText },
    { type: "rect", xMm: margin, yMm: 164, wMm: PAGE_W - margin * 2, hMm: 40, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.md },
    { type: "text", xMm: margin + 6, yMm: 171, wMm: PAGE_W - margin * 2 - 12, hMm: 11, text: narrative.summary, fontSizePt: tokens.fontScalePt.body, bold: true, color: tokens.colors.inverseText },
    { type: "text", xMm: margin + 6, yMm: 184, wMm: PAGE_W - margin * 2 - 12, hMm: 14, text: narrative.callout, fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.inverseText },
  ];

  const cardText = [
    bullets(narrative.bulletsA),
    bullets(narrative.bulletsB),
    `${narrative.metrics[0].label}: ${narrative.metrics[0].value}\n${narrative.metrics[1].label}: ${narrative.metrics[1].value}\n${narrative.metrics[2].label}: ${narrative.metrics[2].value}`,
  ];
  cardText.forEach((text, index) => {
    const x = margin + index * (cardW + cardGap);
    elements.push(
      { type: "rect", xMm: x, yMm: 210, wMm: cardW, hMm: 66, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
      { type: "text", xMm: x + 4, yMm: 216, wMm: cardW - 8, hMm: 54, text, fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    );
  });

  addPageFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildPage(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
  template: TemplateKey,
): PageLayout {
  if (template === "hero-ribbon") {
    return buildHeroRibbon(image, narrative, pageNumber, tokens);
  }
  if (template === "editorial-split") {
    return buildEditorialSplit(image, narrative, pageNumber, tokens);
  }
  if (template === "insight-grid") {
    return buildInsightGrid(image, narrative, pageNumber, tokens);
  }
  if (template === "framed-focus") {
    return buildFramedFocus(image, narrative, pageNumber, tokens);
  }
  return buildDualPanels(image, narrative, pageNumber, tokens);
}

export function generateLayout(orderedImages: ScannedImage[], tokens: LayoutTokens): PageLayout[] {
  const countsByCategory: Record<PageCategory, number> = {
    dispense: 0,
    app: 0,
    consult: 0,
    report: 0,
    package: 0,
    generic: 0,
  };

  return orderedImages.map((image, index) => {
    const caption = cleanCaptionFromFilename(image.filename);
    const category = detectCategory(image.filename);
    const categoryCount = countsByCategory[category];
    const template = fallbackTemplate(image, index);
    const story = buildStoryDefinition(category, categoryCount, caption, template);
    const narrative = buildNarrative(story, caption);
    countsByCategory[category] += 1;

    return buildPage(image, narrative, index + 1, tokens, story.template);
  });
}
