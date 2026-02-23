import path from "node:path";
import type { ScannedImage } from "@/src/io/scanImages";
import type { LayoutTokens } from "@/src/layout/tokens";
import { PAGE_SIZE_A4_PORTRAIT, type PageLayout } from "@/src/layout/types";

type TemplateKey = "hero" | "split" | "board" | "closing";

type BrochureCopy = {
  template: TemplateKey;
  kicker: string;
  title: string;
  summary: string;
  bullets: string[];
  secondaryBullets?: string[];
  badgeLabel?: string;
  badgeValue?: string;
  note?: string;
  footer?: string;
};

const PAGE_WIDTH_MM = PAGE_SIZE_A4_PORTRAIT.widthMm;
const PAGE_HEIGHT_MM = PAGE_SIZE_A4_PORTRAIT.heightMm;

const COPY_BY_KEY = {
  cover: {
    template: "hero",
    kicker: "WELLNESSBOX B2B",
    title: "임직원 건강복지를 ESG 성과로 전환합니다",
    summary: "약국 기반 개인맞춤 영양제 복지 솔루션",
    bullets: [
      "건강 데이터 기반 개인 맞춤 설계",
      "1개월 단위 소분 패키지 정기 제공",
      "매월 재점검 후 조합 조정 및 약사 상담 연계",
    ],
    badgeLabel: "운영 방식",
    badgeValue: "기업 맞춤형",
    footer: "약국 기반 개인맞춤 영양 복지 솔루션",
  } satisfies BrochureCopy,

  package: {
    template: "split",
    kicker: "PERSONALIZED PACKAGE",
    title: "한 통이 아닌 매일 섭취 단위로 제공합니다",
    summary:
      "웰니스박스는 임직원 건강 상태와 목적에 맞춘 영양 조합을 설계하고, 약국을 통해 1개월분 소분 패키지를 전달합니다.",
    bullets: [
      "하루 단위 소분으로 복용 편의성과 지속률 강화",
      "개인별 목적에 맞는 성분 조합으로 설계",
      "월별 리뷰를 기반으로 구성을 유연하게 조정",
    ],
    note: "관리형 복지 서비스로 임직원 체감 만족도를 높입니다.",
    footer: "Box + Report + App이 연결된 통합 건강관리 경험",
  } satisfies BrochureCopy,

  report: {
    template: "board",
    kicker: "MONTHLY HEALTH REPORT",
    title: "매달 받는 개인 건강관리 리포트",
    summary: "핵심 지표와 우선 관리 영역, 복용 가이드를 한 화면에 제공합니다.",
    bullets: [
      "건강 점수와 최근 변화 추이 한눈에 확인",
      "우선 관리 영역별 밸런스 상태 제시",
      "실행 가능한 복용 타이밍 가이드 제공",
    ],
    secondaryBullets: [
      "임직원은 변화 내용을 월 단위로 추적",
      "기업은 운영 리포트로 참여 현황 점검",
      "다음 달 조정 포인트를 빠르게 의사결정",
    ],
    note: "데이터가 쌓일수록 맞춤 정확도와 실행률이 함께 높아집니다.",
    footer: "건강 데이터 기반 개인맞춤 설계",
  } satisfies BrochureCopy,

  process: {
    template: "board",
    kicker: "EMPLOYEE JOURNEY",
    title: "임직원 경험 흐름은 단순하고 반복 가능합니다",
    summary: "도입 후 매월 같은 리듬으로 건강관리 사이클이 운영됩니다.",
    bullets: [
      "건강 체크 설문 및 검진 데이터 연동",
      "개인 맞춤 소분 패키지 수령",
      "월간 리포트 확인 및 실천",
    ],
    secondaryBullets: [
      "재검사 결과 기반 성분/용량 조정",
      "필요 시 약사 상담으로 복용 이슈 해결",
      "다음 달 목표를 개인별로 업데이트",
    ],
    note: "복잡한 복지 운영을 표준화된 월간 프로세스로 바꿉니다.",
    footer: "정기 운영에 최적화된 B2B 복지 프로그램",
  } satisfies BrochureCopy,

  personalized: {
    template: "split",
    kicker: "CONTINUOUS OPTIMIZATION",
    title: "재검사와 상담 데이터로 조합을 계속 고도화합니다",
    summary:
      "초기 설계에서 끝나지 않고 매월 재평가를 통해 구성과 복용 계획을 업데이트해 개인 적합도를 높입니다.",
    bullets: [
      "건강/상담 데이터를 기반으로 맞춤 조정",
      "복용 부담을 줄이고 필요한 성분은 강화",
      "기업과 임직원 모두 변화 근거를 확인 가능",
    ],
    note: "처음의 추천을 유지하는 방식이 아닌, 계속 개선되는 관리형 구조입니다.",
    footer: "개인별 상태에 맞춰 매달 달라지는 영양 복지",
  } satisfies BrochureCopy,

  app: {
    template: "split",
    kicker: "DIGITAL EXPERIENCE",
    title: "전용 앱으로 리포트 조회와 상담 연결까지",
    summary: "임직원은 앱에서 누적 건강 리포트를 확인하고 필요한 상담을 즉시 신청할 수 있습니다.",
    bullets: [
      "개인별 건강 변화 기록을 월별로 조회",
      "생활 습관 실천 가이드와 알림 제공",
      "온라인 상담 연계로 실행 공백 최소화",
    ],
    note: "오프라인 패키지와 디지털 경험이 함께 작동합니다.",
    footer: "복지 프로그램 참여율을 높이는 전용 접점",
  } satisfies BrochureCopy,

  esg: {
    template: "hero",
    kicker: "ESG IMPACT",
    title: "임직원 건강관리는 ESG 사회(S) 성과로 연결됩니다",
    summary:
      "운영 내용, 정기성, 참여 규모를 근거로 보고서에 담을 수 있는 복지 활동으로 설계되어 있습니다.",
    bullets: [
      "복리후생비(S-2-5) 분류 가능한 정기 프로그램",
      "운영 실적과 참여 데이터를 문서화해 보고 가능",
      "대기업 ESG 보고서 포맷에 맞춘 사례화 지원",
    ],
    badgeLabel: "ESG 포인트",
    badgeValue: "사회(S) 영역",
    footer: "보고서에 남는 임직원 건강증진 프로그램",
  } satisfies BrochureCopy,

  consultation: {
    template: "closing",
    kicker: "PHARMACIST CONSULTING",
    title: "약사 상담으로 임직원 건강관리 실행력을 높입니다",
    summary: "기업 도입 목적과 임직원 특성에 맞는 운영안을 함께 설계합니다.",
    bullets: [
      "정기 방문/온라인 상담 연계",
      "복용 이슈와 생활 습관 코칭 지원",
      "기업별 운영 리듬에 맞춘 협의 가능",
    ],
    footer: "문의: wellnessbox.me@gmail.com | 02-6241-5530",
  } satisfies BrochureCopy,
} as const;

const DEFAULT_COPY_ORDER: BrochureCopy[] = [
  COPY_BY_KEY.cover,
  COPY_BY_KEY.package,
  COPY_BY_KEY.report,
  COPY_BY_KEY.process,
  COPY_BY_KEY.personalized,
  COPY_BY_KEY.app,
  COPY_BY_KEY.esg,
  COPY_BY_KEY.consultation,
];

function cleanCaptionFromFilename(filename: string): string {
  const stem = path.parse(filename).name;
  const withoutPrefix = stem.replace(
    /^\s*(?:\(\s*\d+\s*\)|p\s*\d+|\d+)(?:[\s._-]+)?/i,
    "",
  );

  const cleaned = withoutPrefix
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const fallback = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const finalText = cleaned.length > 0 ? cleaned : fallback;

  if (!finalText) {
    return "Untitled image";
  }

  return finalText;
}

function parseSlicedImageVariant(filename: string): number {
  const stem = path.parse(filename).name;
  const match = stem.match(/_(\d+)\s*$/);
  if (!match) {
    return 1;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function detectCopyForImage(image: ScannedImage, index: number): BrochureCopy {
  const stem = path.parse(image.filename).name;
  const normalized = stem.replace(/\s+/g, "").toLowerCase();

  if (normalized.includes("앱웹화면")) {
    return COPY_BY_KEY.app;
  }
  if (normalized.includes("건강레포트")) {
    return COPY_BY_KEY.report;
  }
  if (normalized.includes("약사상담")) {
    return COPY_BY_KEY.consultation;
  }
  if (normalized.includes("패키지")) {
    return COPY_BY_KEY.cover;
  }
  if (normalized.includes("소분건기식이미지")) {
    const variant = parseSlicedImageVariant(image.filename);
    if (variant === 1) {
      return COPY_BY_KEY.package;
    }
    if (variant === 2) {
      return COPY_BY_KEY.process;
    }
    if (variant === 3) {
      return COPY_BY_KEY.personalized;
    }
    return COPY_BY_KEY.esg;
  }

  return DEFAULT_COPY_ORDER[index % DEFAULT_COPY_ORDER.length];
}

function buildFallbackCopy(caption: string): BrochureCopy {
  return {
    template: "split",
    kicker: "WELLNESSBOX",
    title: caption,
    summary: "이미지 기반으로 구성된 서비스 소개 페이지입니다.",
    bullets: [
      "기업 임직원 대상 맞춤형 건강관리",
      "소분 패키지 + 리포트 + 상담 연계",
      "A4 기반 문서/PPTX 편집형 결과물",
    ],
    note: "필요 시 이미지를 교체하고 다시 생성하면 같은 규칙으로 재배치됩니다.",
    footer: caption,
  };
}

function bulletLines(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

function buildHeroPage(
  image: ScannedImage,
  copy: BrochureCopy,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const headerHeightMm = 92;
  const footerHeightMm = 12;
  const imageTopMm = headerHeightMm + 4;
  const imageHeightMm = PAGE_HEIGHT_MM - imageTopMm - margin - footerHeightMm;
  const badgeWidthMm = 58;
  const badgeX = PAGE_WIDTH_MM - margin - badgeWidthMm;
  const footerY = PAGE_HEIGHT_MM - margin - footerHeightMm;

  return {
    pageNumber,
    elements: [
      {
        type: "rect",
        xMm: 0,
        yMm: 0,
        wMm: PAGE_WIDTH_MM,
        hMm: PAGE_HEIGHT_MM,
        fill: tokens.colors.page,
      },
      {
        type: "rect",
        xMm: 0,
        yMm: 0,
        wMm: PAGE_WIDTH_MM,
        hMm: headerHeightMm,
        fill: tokens.colors.softAccent,
      },
      {
        type: "text",
        xMm: margin,
        yMm: 12,
        wMm: PAGE_WIDTH_MM - margin * 2 - badgeWidthMm - 6,
        hMm: 8,
        text: copy.kicker,
        fontSizePt: tokens.fontScalePt.caption,
        bold: true,
        color: tokens.colors.accent,
      },
      {
        type: "text",
        xMm: margin,
        yMm: 22,
        wMm: PAGE_WIDTH_MM - margin * 2 - badgeWidthMm - 6,
        hMm: 30,
        text: copy.title,
        fontSizePt: tokens.fontScalePt.title,
        bold: true,
        color: tokens.colors.text,
      },
      {
        type: "text",
        xMm: margin,
        yMm: 54,
        wMm: PAGE_WIDTH_MM - margin * 2 - badgeWidthMm - 6,
        hMm: 12,
        text: copy.summary,
        fontSizePt: tokens.fontScalePt.body,
        color: tokens.colors.mutedText,
      },
      {
        type: "text",
        xMm: margin,
        yMm: 67,
        wMm: PAGE_WIDTH_MM - margin * 2 - badgeWidthMm - 6,
        hMm: 24,
        text: bulletLines(copy.bullets),
        fontSizePt: tokens.fontScalePt.caption,
        color: tokens.colors.text,
      },
      {
        type: "rect",
        xMm: badgeX,
        yMm: 14,
        wMm: badgeWidthMm,
        hMm: 36,
        fill: tokens.colors.page,
        radiusMm: tokens.radiusMm.md,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.35,
      },
      {
        type: "text",
        xMm: badgeX + 4,
        yMm: 20,
        wMm: badgeWidthMm - 8,
        hMm: 8,
        text: copy.badgeLabel ?? "SERVICE",
        fontSizePt: tokens.fontScalePt.caption,
        bold: true,
        color: tokens.colors.mutedText,
      },
      {
        type: "text",
        xMm: badgeX + 4,
        yMm: 29,
        wMm: badgeWidthMm - 8,
        hMm: 12,
        text: copy.badgeValue ?? "Wellnessbox",
        fontSizePt: tokens.fontScalePt.subtitle,
        bold: true,
        color: tokens.colors.accent,
      },
      {
        type: "image",
        xMm: margin,
        yMm: imageTopMm,
        wMm: PAGE_WIDTH_MM - margin * 2,
        hMm: imageHeightMm,
        srcPublicPath: image.publicPath,
        fit: "contain",
      },
      {
        type: "line",
        x1Mm: margin,
        y1Mm: footerY,
        x2Mm: PAGE_WIDTH_MM - margin,
        y2Mm: footerY,
        stroke: tokens.colors.border,
        widthMm: 0.3,
      },
      {
        type: "text",
        xMm: margin,
        yMm: footerY + 2.5,
        wMm: PAGE_WIDTH_MM - margin * 2,
        hMm: 8,
        text: copy.footer ?? copy.summary,
        fontSizePt: tokens.fontScalePt.caption,
        color: tokens.colors.mutedText,
      },
    ],
  };
}

function buildSplitPage(
  image: ScannedImage,
  copy: BrochureCopy,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const gutter = tokens.spacingMm.gutter;
  const panelWidthMm = 74;
  const contentHeightMm = PAGE_HEIGHT_MM - margin * 2;
  const imageWidthMm = PAGE_WIDTH_MM - margin * 2 - gutter - panelWidthMm;
  const panelX = margin + imageWidthMm + gutter;

  return {
    pageNumber,
    elements: [
      {
        type: "rect",
        xMm: 0,
        yMm: 0,
        wMm: PAGE_WIDTH_MM,
        hMm: PAGE_HEIGHT_MM,
        fill: tokens.colors.page,
      },
      {
        type: "image",
        xMm: margin,
        yMm: margin,
        wMm: imageWidthMm,
        hMm: contentHeightMm,
        srcPublicPath: image.publicPath,
        fit: "cover",
      },
      {
        type: "rect",
        xMm: panelX,
        yMm: margin,
        wMm: panelWidthMm,
        hMm: contentHeightMm,
        fill: tokens.colors.softAccent,
        radiusMm: tokens.radiusMm.md,
      },
      {
        type: "text",
        xMm: panelX + 5,
        yMm: margin + 8,
        wMm: panelWidthMm - 10,
        hMm: 8,
        text: copy.kicker,
        fontSizePt: tokens.fontScalePt.caption,
        bold: true,
        color: tokens.colors.accent,
      },
      {
        type: "text",
        xMm: panelX + 5,
        yMm: margin + 18,
        wMm: panelWidthMm - 10,
        hMm: 34,
        text: copy.title,
        fontSizePt: tokens.fontScalePt.subtitle,
        bold: true,
        color: tokens.colors.text,
      },
      {
        type: "text",
        xMm: panelX + 5,
        yMm: margin + 54,
        wMm: panelWidthMm - 10,
        hMm: 40,
        text: copy.summary,
        fontSizePt: tokens.fontScalePt.body,
        color: tokens.colors.mutedText,
      },
      {
        type: "line",
        x1Mm: panelX + 5,
        y1Mm: margin + 96,
        x2Mm: panelX + panelWidthMm - 5,
        y2Mm: margin + 96,
        stroke: tokens.colors.border,
        widthMm: 0.3,
      },
      {
        type: "text",
        xMm: panelX + 5,
        yMm: margin + 100,
        wMm: panelWidthMm - 10,
        hMm: 92,
        text: bulletLines(copy.bullets),
        fontSizePt: tokens.fontScalePt.caption,
        color: tokens.colors.text,
      },
      {
        type: "rect",
        xMm: panelX + 5,
        yMm: PAGE_HEIGHT_MM - margin - 58,
        wMm: panelWidthMm - 10,
        hMm: 48,
        fill: tokens.colors.page,
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.3,
      },
      {
        type: "text",
        xMm: panelX + 8,
        yMm: PAGE_HEIGHT_MM - margin - 53,
        wMm: panelWidthMm - 16,
        hMm: 40,
        text: copy.note ?? copy.footer ?? copy.summary,
        fontSizePt: tokens.fontScalePt.caption,
        color: tokens.colors.mutedText,
      },
    ],
  };
}

function buildBoardPage(
  image: ScannedImage,
  copy: BrochureCopy,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const topImageHeightMm = 116;
  const topImageBottom = margin + topImageHeightMm;
  const contentTop = topImageBottom + 7;
  const cardsTop = contentTop + 40;
  const cardsHeightMm = 64;
  const highlightTop = cardsTop + cardsHeightMm + 7;
  const gutter = tokens.spacingMm.gutter;
  const cardWidthMm = (PAGE_WIDTH_MM - margin * 2 - gutter) / 2;

  return {
    pageNumber,
    elements: [
      {
        type: "rect",
        xMm: 0,
        yMm: 0,
        wMm: PAGE_WIDTH_MM,
        hMm: PAGE_HEIGHT_MM,
        fill: tokens.colors.page,
      },
      {
        type: "image",
        xMm: margin,
        yMm: margin,
        wMm: PAGE_WIDTH_MM - margin * 2,
        hMm: topImageHeightMm,
        srcPublicPath: image.publicPath,
        fit: "cover",
      },
      {
        type: "text",
        xMm: margin,
        yMm: contentTop,
        wMm: PAGE_WIDTH_MM - margin * 2,
        hMm: 8,
        text: copy.kicker,
        fontSizePt: tokens.fontScalePt.caption,
        bold: true,
        color: tokens.colors.accent,
      },
      {
        type: "text",
        xMm: margin,
        yMm: contentTop + 9,
        wMm: PAGE_WIDTH_MM - margin * 2,
        hMm: 16,
        text: copy.title,
        fontSizePt: tokens.fontScalePt.subtitle,
        bold: true,
        color: tokens.colors.text,
      },
      {
        type: "text",
        xMm: margin,
        yMm: contentTop + 26,
        wMm: PAGE_WIDTH_MM - margin * 2,
        hMm: 12,
        text: copy.summary,
        fontSizePt: tokens.fontScalePt.body,
        color: tokens.colors.mutedText,
      },
      {
        type: "rect",
        xMm: margin,
        yMm: cardsTop,
        wMm: cardWidthMm,
        hMm: cardsHeightMm,
        fill: tokens.colors.softAccent,
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.3,
      },
      {
        type: "rect",
        xMm: margin + cardWidthMm + gutter,
        yMm: cardsTop,
        wMm: cardWidthMm,
        hMm: cardsHeightMm,
        fill: "#F2F6FF",
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.3,
      },
      {
        type: "text",
        xMm: margin + 4,
        yMm: cardsTop + 5,
        wMm: cardWidthMm - 8,
        hMm: cardsHeightMm - 10,
        text: bulletLines(copy.bullets),
        fontSizePt: tokens.fontScalePt.caption,
        color: tokens.colors.text,
      },
      {
        type: "text",
        xMm: margin + cardWidthMm + gutter + 4,
        yMm: cardsTop + 5,
        wMm: cardWidthMm - 8,
        hMm: cardsHeightMm - 10,
        text: bulletLines(copy.secondaryBullets ?? copy.bullets),
        fontSizePt: tokens.fontScalePt.caption,
        color: tokens.colors.text,
      },
      {
        type: "rect",
        xMm: margin,
        yMm: highlightTop,
        wMm: PAGE_WIDTH_MM - margin * 2,
        hMm: 22,
        fill: tokens.colors.accent,
        radiusMm: tokens.radiusMm.sm,
      },
      {
        type: "text",
        xMm: margin + 5,
        yMm: highlightTop + 5,
        wMm: PAGE_WIDTH_MM - margin * 2 - 10,
        hMm: 12,
        text: copy.note ?? copy.footer ?? copy.summary,
        fontSizePt: tokens.fontScalePt.caption,
        bold: true,
        color: "#FFFFFF",
      },
    ],
  };
}

function buildClosingPage(
  image: ScannedImage,
  copy: BrochureCopy,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const panelHeightMm = 112;
  const panelY = PAGE_HEIGHT_MM - margin - panelHeightMm;

  return {
    pageNumber,
    elements: [
      {
        type: "image",
        xMm: 0,
        yMm: 0,
        wMm: PAGE_WIDTH_MM,
        hMm: PAGE_HEIGHT_MM,
        srcPublicPath: image.publicPath,
        fit: "cover",
      },
      {
        type: "rect",
        xMm: margin,
        yMm: panelY,
        wMm: PAGE_WIDTH_MM - margin * 2,
        hMm: panelHeightMm,
        fill: tokens.colors.page,
        radiusMm: tokens.radiusMm.md,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.4,
      },
      {
        type: "text",
        xMm: margin + 6,
        yMm: panelY + 9,
        wMm: PAGE_WIDTH_MM - margin * 2 - 12,
        hMm: 8,
        text: copy.kicker,
        fontSizePt: tokens.fontScalePt.caption,
        bold: true,
        color: tokens.colors.accent,
      },
      {
        type: "text",
        xMm: margin + 6,
        yMm: panelY + 19,
        wMm: PAGE_WIDTH_MM - margin * 2 - 12,
        hMm: 22,
        text: copy.title,
        fontSizePt: tokens.fontScalePt.subtitle,
        bold: true,
        color: tokens.colors.text,
      },
      {
        type: "text",
        xMm: margin + 6,
        yMm: panelY + 44,
        wMm: PAGE_WIDTH_MM - margin * 2 - 12,
        hMm: 16,
        text: copy.summary,
        fontSizePt: tokens.fontScalePt.body,
        color: tokens.colors.mutedText,
      },
      {
        type: "text",
        xMm: margin + 6,
        yMm: panelY + 62,
        wMm: PAGE_WIDTH_MM - margin * 2 - 12,
        hMm: 26,
        text: bulletLines(copy.bullets),
        fontSizePt: tokens.fontScalePt.caption,
        color: tokens.colors.text,
      },
      {
        type: "line",
        x1Mm: margin + 6,
        y1Mm: panelY + 91,
        x2Mm: PAGE_WIDTH_MM - margin - 6,
        y2Mm: panelY + 91,
        stroke: tokens.colors.border,
        widthMm: 0.3,
      },
      {
        type: "text",
        xMm: margin + 6,
        yMm: panelY + 95,
        wMm: PAGE_WIDTH_MM - margin * 2 - 12,
        hMm: 10,
        text: copy.footer ?? "Wellnessbox",
        fontSizePt: tokens.fontScalePt.caption,
        bold: true,
        color: tokens.colors.mutedText,
      },
    ],
  };
}

function buildPage(
  image: ScannedImage,
  copy: BrochureCopy,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  if (copy.template === "hero") {
    return buildHeroPage(image, copy, pageNumber, tokens);
  }
  if (copy.template === "board") {
    return buildBoardPage(image, copy, pageNumber, tokens);
  }
  if (copy.template === "closing") {
    return buildClosingPage(image, copy, pageNumber, tokens);
  }
  return buildSplitPage(image, copy, pageNumber, tokens);
}

export function generateLayout(
  orderedImages: ScannedImage[],
  tokens: LayoutTokens,
): PageLayout[] {
  return orderedImages.map((image, index) => {
    const pageNumber = index + 1;
    const caption = cleanCaptionFromFilename(image.filename);
    const detectedCopy = detectCopyForImage(image, index);
    const copy = detectedCopy.title ? detectedCopy : buildFallbackCopy(caption);

    return buildPage(image, copy, pageNumber, tokens);
  });
}
